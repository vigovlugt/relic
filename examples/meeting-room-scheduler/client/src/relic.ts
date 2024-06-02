import { createSqliteWasmDb } from "@relic/sqlite-wasm";
import SqliteWasmWorker from "@relic/sqlite-wasm/worker?worker";
import { drizzle, ssePoker, createRelicClient } from "@relic/client";
import { QueryClient } from "@tanstack/react-query";
import { drizzleSchema, migrations } from "@mrs/shared";
import { relicClient } from "./relic-client.ts";

let user = localStorage.getItem("user") ?? "";
if (!user) {
    user = prompt("Enter your name") ?? "John Doe";
    localStorage.setItem("user", user);
}

export const queryClient = new QueryClient();

export const sqlite = await createSqliteWasmDb(new SqliteWasmWorker());
await sqlite.exec(migrations);

export const db = drizzle(sqlite, {
    schema: drizzleSchema,
});

const url =
    import.meta.env.VITE_SERVER_URL ??
    "http://localhost:3000/relic?user=" + user;

export const relic = await createRelicClient({
    relicClient,
    queryClient,
    db,
    sqlite,
    url,
    context: {
        user,
    },
    poker: ssePoker({
        url: url.split("?")[0] + "/poke",
    }),
});
