import { createSqliteWasmDb } from "@relic/sqlite-wasm";
import SqliteWasmWorker from "@relic/sqlite-wasm/worker?worker";
import { drizzle, ssePoker, createRelicClient } from "@relic/client";
import { QueryClient } from "@tanstack/react-query";
import { drizzleSchema, migrations } from "@mrs/shared";
import { relicClient } from "./relic-client.ts";

let user = localStorage.getItem("user");
if (!user) {
    user = prompt("Enter your name") ?? "";
    localStorage.setItem("user", user);
}

export const queryClient = new QueryClient();

export const sqlite = await createSqliteWasmDb(new SqliteWasmWorker());
await sqlite.exec(migrations);

export const db = drizzle(sqlite, {
    schema: drizzleSchema,
});

const url = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000/relic";

export const relic = await createRelicClient({
    relicClient,
    queryClient,
    db,
    sqlite,
    url,
    context: {
        user,
    },
    pusher: async (push) => {
        const res = await fetch(
            url + "/push?user=" + encodeURIComponent(user),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(push),
            }
        );
        if (!res.ok) {
            throw new Error("Failed to push mutations: " + res.statusText);
        }
    },
    puller: async (pull) => {
        const res = await fetch(
            url + "/pull?user=" + encodeURIComponent(user),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(pull),
            }
        );
        if (!res.ok) {
            throw new Error("Failed to pull mutations: " + res.statusText);
        }

        return await res.json();
    },
    // TODO: Remove url necessity
    poker: ssePoker({
        url: url + "/poke",
    }),
});
