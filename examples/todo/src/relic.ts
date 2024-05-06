import { QueryClient } from "@tanstack/react-query";
import { createRelicVanillaClient } from "../../../src/client/vanilla-client.ts";
import { relicClient } from "./client.ts";
import { createSqliteWasmDb } from "../../../src/sqlite-wasm/index.ts";
import { drizzle } from "../../../src/client/database/drizzle.ts";
import { migrations } from "./db.ts";

export const queryClient = new QueryClient();

export const sqlite = await createSqliteWasmDb();
await sqlite.exec(migrations);
export const db = drizzle(sqlite);

export const relic = await createRelicVanillaClient({
    relicClient,
    queryClient,
    context: {},
    sqlite,
    db,
    url: "http://localhost:3000",
});
