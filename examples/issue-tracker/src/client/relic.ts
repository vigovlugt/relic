import { QueryClient } from "@tanstack/react-query";
import { createRelicClient, drizzle, ssePokeAdapter } from "@relic/client";
import { relicClient } from "./client.ts";
import { createSqliteWasmDb } from "@relic/sqlite-wasm";
import SqliteWasmWorker from "@relic/sqlite-wasm/worker?worker";
import {
    comments,
    commentsRelations,
    issues,
    issuesRelations,
    migrations,
} from "../db.ts";

export const queryClient = new QueryClient();

export const sqlite = await createSqliteWasmDb(new SqliteWasmWorker());
await sqlite.exec(migrations);
export const db = drizzle(sqlite, {
    schema: {
        issues,
        comments,
        issuesRelations,
        commentsRelations,
    },
});

export const relic = await createRelicClient({
    relicClient,
    queryClient,
    context: {},
    sqlite,
    db,
    url: import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000/relic",
    pokeAdapter: ssePokeAdapter({
        url: import.meta.env.VITE_SERVER_URL
            ? import.meta.env.VITE_SERVER_URL + "/poke"
            : "http://localhost:3000/relic/poke",
    }),
});
