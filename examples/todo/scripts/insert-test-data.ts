import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { todos } from "../src/server/db";

const sqlite = new Database("sqlite.db");
const db = drizzle(sqlite);

for (let i = 0; i < 10000; i++) {
    db.insert(todos)
        .values({
            id: crypto.randomUUID(),
            name: `Todo ${i}`,
            done: Math.random() > 0.1,
        })
        .execute();
}
