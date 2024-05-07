import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { relicDefinition } from "./definition";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
    SQLiteTransaction,
    integer,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";
import { eq, not, sql } from "drizzle-orm";
import * as y from "../../../../src/server/relic-request-handler";
import * as x from "../../../../src/server/relic-server-builder";
import * as z from "../../../../src/server/drizzle/sqlite-adapter";

const sqlite = new Database("sqlite.db");
const db = drizzle(sqlite);

const clients = sqliteTable("relic_clients", {
    id: text("id").primaryKey(),
    mutationId: integer("mutation_id").notNull(),
});

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

sqlite.exec(`
CREATE TABLE IF NOT EXISTS relic_clients (
    id TEXT PRIMARY KEY,
    mutation_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    name TEXT NOT NULL,
    done INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 0
);`);

const s = x.initRelicServer(relicDefinition).transaction<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SQLiteTransaction<any, any, any, any>
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

const puller = s.puller.pull(async ({ tx }) => {
    return {
        clear: true,
        entities: {
            todos: {
                put: await tx.select().from(todos),
                delete: [],
            },
        },
    };
});

const relicServer = s.pull(puller).mutations({
    addTodo,
    deleteTodo,
    toggleTodo,
    updateTodo,
});

const app = new Hono();
app.use("*", cors());
app.all("/relic/*", async (c) => {
    return y.relicRequestHandler({
        req: c.req.raw,
        context: {},
        relicServer,
        database: z.sqliteAdapter(db, clients),
    });
});
serve({
    fetch: app.fetch,
    port: 3000,
});
console.log("Server running on http://localhost:3000");
