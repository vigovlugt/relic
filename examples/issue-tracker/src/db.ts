import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const PRIORITIES = ["none", "urgent", "high", "medium", "low"] as const;
export const STATUSES = [
    "backlog",
    "todo",
    "in_progress",
    "done",
    "cancelled",
] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

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
        enum: PRIORITIES,
    })
        .notNull()
        .default("none"),
    status: text("status", {
        enum: STATUSES,
    })
        .notNull()
        .default("backlog"),
});

export const issuesRelations = relations(issues, ({ many }) => ({
    comments: many(comments),
}));

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
});

export const commentsRelations = relations(comments, ({ one }) => ({
    issue: one(issues, { fields: [comments.issueId], references: [issues.id] }),
}));

export const migrations = `
CREATE TABLE IF NOT EXISTS issues  (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'none',
    status TEXT NOT NULL DEFAULT 'backlog'
);

CREATE TABLE IF NOT EXISTS comments  (
    id TEXT PRIMARY KEY,
    issue_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
    body TEXT NOT NULL,
    FOREIGN KEY (issue_id) REFERENCES issues (id) ON DELETE CASCADE
);
`;

export const schema = {
    issues,
    comments,
};
