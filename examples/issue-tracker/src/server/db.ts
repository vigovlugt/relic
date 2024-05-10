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

const version = () =>
    integer("version")
        .notNull()
        .default(0)
        .$onUpdate(() => sql`version + 1`);

export const issues = sqliteTable("issues", {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", {
        mode: "timestamp_ms",
    })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    modifiedAt: integer("modified_at", {
        mode: "timestamp_ms",
    })
        .notNull()
        .$onUpdateFn(() => new Date()),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    priority: text("priority", {
        enum: ["none", "urgent", "high", "medium", "low"],
    })
        .notNull()
        .default("none"),
    status: text("status", {
        enum: ["backlog", "todo", "in_progress", "done", "cancelled"],
    })
        .notNull()
        .default("backlog"),
    version: version(),
});

export const comments = sqliteTable("comments", {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
        .notNull()
        .references(() => issues.id, {
            onDelete: "cascade",
        }),
    createdAt: integer("created_at", {
        mode: "timestamp_ms",
    })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    body: text("body").notNull(),
    version: version(),
});

export const schema = {
    issues,
    comments,
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

CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'none',
    status TEXT NOT NULL DEFAULT 'backlog',
    version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    body TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (issue_id) REFERENCES issues (id) ON DELETE CASCADE
);
`;
