import { QueryClient } from "@tanstack/react-query";
import { createRelicClient, drizzle, ssePokeAdapter } from "@relic/client";
import { relicClient } from "./client.ts";
import { createSqliteWasmDb } from "@relic/sqlite-wasm";
import SqliteWasmWorker from "@relic/sqlite-wasm/worker?worker";
import { migrations, schema } from "../db.ts";

export const queryClient = new QueryClient();

export const sqlite = await createSqliteWasmDb(new SqliteWasmWorker());
await sqlite.exec(migrations);
export const db = drizzle(sqlite, {
    schema,
});

export const relic = await createRelicClient({
    relicClient,
    queryClient,
    context: {},
    sqlite,
    db,
    url: "http://localhost:3000/relic",
    pokeAdapter: ssePokeAdapter({
        url: "http://localhost:3000/relic/poke",
    }),
});
