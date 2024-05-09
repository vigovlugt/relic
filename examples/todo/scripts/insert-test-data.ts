import Database from "better-sqlite3";

const sqlite = new Database("sqlite.db");

for (let i = 0; i < 10000; i++) {
    sqlite.prepare(`INSERT INTO todos (id, name, done) VALUES (?, ?, ?)`).run(
        crypto.randomUUID(),
        `Todo ${i}`,
        Math.random() > 0.1
    );
}
