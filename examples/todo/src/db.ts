import {
    integer,
    primaryKey,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";

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
});

export const todoUsers = sqliteTable(
    "todo_users",
    {
        todoId: text("todo_id"),
        userId: text("user_id").primaryKey(),
    },
    (self) => ({
        pk: primaryKey({ columns: [self.todoId, self.userId] }),
    })
);

export const migrations = `
CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    name TEXT NOT NULL,
    done INTEGER NOT NULL
);
`;

export const schema = {
    todos,
};
