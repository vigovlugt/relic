import Database from "better-sqlite3";

const sqlite = new Database("sqlite.db");

sqlite.prepare("BEGIN").run();
for (let i = 0; i < 90000; i++) {
    sqlite
        .prepare(
            `INSERT INTO todos (id, name, done, created_at) VALUES (?, ?, ?, 0)`
        )
        .run(crypto.randomUUID(), `Todo ${i}`, Number(Math.random() > 0.1));
}
sqlite.prepare("COMMIT").run();
