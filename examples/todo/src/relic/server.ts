import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { relicDefinition } from "./definition";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
    integer,
    primaryKey,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";
import { and, eq, inArray, lte, not, sql } from "drizzle-orm";
import { relicRequestHandler } from "../../../../src/server/relic-request-handler";
import { initRelicServer } from "../../../../src/server/relic-server-builder";
import { rowVersion } from "../../../../src/server/delta/row-version";
import {
    ExtractTransaction,
    sqliteAdapter,
} from "../../../../src/server/drizzle/sqlite-adapter";

const clients = sqliteTable("relic_clients", {
    id: text("id").primaryKey(),
    mutationId: integer("mutation_id").notNull(),
});

const clientViews = sqliteTable(
    "relic_client_views",
    {
        clientId: text("client_id").notNull(),
        viewId: integer("view_id").notNull(),
        view: text("view").notNull(),
    },
    (t) => ({
        pk: primaryKey({
            columns: [t.clientId, t.viewId],
        }),
    })
);

const todos = sqliteTable("todos", {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", {
        mode: "timestamp_ms",
    })
        .notNull()
        .defaultNow(),
    name: text("name").notNull(),
    done: integer("done", {
        mode: "boolean",
    }).notNull(),
    version: integer("version")
        .notNull()
        .default(0)
        .$onUpdate(() => sql`version + 1`),
});

const schema = {
    todos,
    clients,
};

const sqlite = new Database("sqlite.db");
const db = drizzle(sqlite, {
    schema,
});

sqlite.exec(`
CREATE TABLE IF NOT EXISTS relic_clients (
    id TEXT PRIMARY KEY,
    mutation_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relic_client_views (
    client_id TEXT NOT NULL,
    view_id INTEGER NOT NULL,
    view TEXT NOT NULL,
    PRIMARY KEY (client_id, view_id)
);

CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    name TEXT NOT NULL,
    done INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 0
);`);

const s =
    initRelicServer(relicDefinition).transaction<
        ExtractTransaction<typeof db>
    >();
const mutation = s.mutation;

const addTodo = mutation.addTodo.mutate(async ({ input, tx }) => {
    await tx.insert(todos).values(input);
});

const deleteTodo = mutation.deleteTodo.mutate(async ({ input, tx }) => {
    await tx.delete(todos).where(eq(todos.id, input));
});

const toggleTodo = mutation.toggleTodo.mutate(async ({ input, tx }) => {
    await tx
        .update(todos)
        .set({
            done: not(todos.done),
        })
        .where(eq(todos.id, input));
});

const updateTodo = mutation.updateTodo.mutate(async ({ input, tx }) => {
    await tx
        .update(todos)
        .set({
            name: input.name,
        })
        .where(eq(todos.id, input.id));
});

// const puller = s.puller.pull(async ({ tx }) => {
//     return {
//         clear: true,
//         entities: {
//             todos: {
//                 put: await tx.select().from(todos),
//                 delete: [],
//             },
//         },
//     };
// });

const rowVersionPuller = s.puller.pull(
    rowVersion(
        s.puller,
        {
            getClientView: async (tx, clientId, viewId) => {
                const str = tx
                    .select()
                    .from(clientViews)
                    .where(
                        and(
                            eq(clientViews.clientId, clientId),
                            eq(clientViews.viewId, viewId)
                        )
                    )
                    .get()?.view;
                return str ? JSON.parse(str) : undefined;
            },
            createClientView: (tx, clientId, viewId, view) => {
                tx.insert(clientViews)
                    .values({
                        clientId,
                        viewId,
                        view: JSON.stringify(view),
                    })
                    .execute();
            },
            deleteClientViews: (tx, clientId: string, maxViewId: number) => {
                tx.delete(clientViews).where(
                    and(
                        eq(clientViews.clientId, clientId),
                        lte(clientViews.viewId, maxViewId)
                    )
                );
            },
        },
        async ({ tx }) => {
            return {
                todos: await tx
                    .select({
                        id: todos.id,
                        version: todos.version,
                    })
                    .from(todos),
            };
        },
        async ({ tx, entities }) => {
            return {
                todos: entities.todos.length
                    ? await tx
                          .select()
                          .from(todos)
                          .where(inArray(todos.id, entities.todos))
                    : [],
            };
        }
    )
);

const relicServer = s.pull(rowVersionPuller).mutations({
    addTodo,
    deleteTodo,
    toggleTodo,
    updateTodo,
});

const app = new Hono();
app.use("*", cors());
app.all("/relic/*", async (c) =>
    relicRequestHandler({
        req: c.req.raw,
        context: {},
        relicServer,
        database: sqliteAdapter(db, clients),
    })
);
serve({
    fetch: app.fetch,
    port: 3000,
});

console.log("Server running on http://localhost:3000");
