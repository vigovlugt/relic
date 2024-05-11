import Database from "better-sqlite3";
import { issues, comments } from "../src/server/db";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { faker } from "@faker-js/faker";

const sqlite = new Database("sqlite.db");
const db = drizzle(sqlite);

db.transaction((tx) => {
    for (let i = 0; i < 10000; i++) {
        const id = crypto.randomUUID();
        tx.insert(issues)
            .values({
                id,
                title: faker.word.words(),
                description: faker.lorem.paragraphs(),
                status: (
                    [
                        "backlog",
                        "todo",
                        "in_progress",
                        "done",
                        "cancelled",
                    ] as const
                )[Math.floor(Math.random() * 5)],
                priority: (
                    ["none", "urgent", "high", "medium", "low"] as const
                )[Math.floor(Math.random() * 5)],
            })
            .execute();

        for (let j = 0; j < 10; j++) {
            tx.insert(comments)
                .values({
                    id: crypto.randomUUID(),
                    issueId: id,
                    body: faker.lorem.paragraph(),
                })
                .execute();
        }
    }
});
