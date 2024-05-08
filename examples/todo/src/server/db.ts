import { sql } from "drizzle-orm";
import {
    text,
    primaryKey,
    integer,
    sqliteTable,
} from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("relic_clients", {
    id: text("id").primaryKey(),
    mutationId: integer("mutation_id").notNull(),
});

export const clientViews = sqliteTable(
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

export const todos = sqliteTable("todos", {
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

export const schema = {
    todos,
    clients,
};
export const migrations = `
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
);`;
