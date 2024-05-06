import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const todos = sqliteTable("todos", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    done: integer("done", {
        mode: "boolean",
    }).notNull(),
});

export const migrations = `
CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    done INTEGER NOT NULL
);
`;

export const schema = {
    todos,
};
