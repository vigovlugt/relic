// import React from "react";
// import ReactDOM from "react-dom/client";
// import App from "./App.tsx";
import "./index.css";
import { createSqliteWasmDb } from "../../../src/sqlite-wasm/index.ts";
import { drizzle } from "../../../src/client/database/drizzle.ts";
import { RollbackManager } from "../../../src/client/database/rollback.ts";
import { text, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";

console.log("Hello from main.tsx");
const sqlite = await createSqliteWasmDb();
console.log("SQLite initialized");
const db = drizzle(sqlite);
const rollbackManager = new RollbackManager(sqlite, "_relic_rollback");

sqlite.exec(`
    DROP TABLE IF EXISTS _relic_rollback;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS teams;
    CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        age INTEGER
    );
    CREATE TABLE teams (
        id TEXT PRIMARY KEY,
        name TEXT
    );

    INSERT INTO users (id, name, age) VALUES ('1', 'Alice', 18);
    INSERT INTO users (id, name, age) VALUES ('2', 'Bob', 18);
    INSERT INTO teams (id, name) VALUES ('1', 'Team 1');
`);

const users = sqliteTable("users", {
    id: text("id"),
    name: text("name"),
    age: integer("age"),
});

const teams = sqliteTable("teams", {
    id: text("id"),
    name: text("name"),
});

await rollbackManager.activate();

console.log("Before:", await db.select().from(users));

await db.insert(teams).values({ id: "2", name: "Team 2" });
await db.insert(users).values({ id: "3", name: "Charlie", age: 18 });
await db.update(users).set({ name: "Delta" }).where(eq(users.id, "1"));
await db.delete(users).where(eq(users.id, "2"));

console.log("Middle:", await db.select().from(users));

await rollbackManager.rollback();
console.log("After:", await db.select().from(users));

// ReactDOM.createRoot(document.getElementById("root")!).render(
//     <React.StrictMode>
//         <App />
//     </React.StrictMode>
// );
