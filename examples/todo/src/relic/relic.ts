import { QueryClient } from "@tanstack/react-query";
import { createRelicClient } from "../../../../src/client/relic-client-instance.ts";
import { relicClient } from "./client.ts";
import { createSqliteWasmDb } from "../../../../src/sqlite-wasm/index.ts";
import { drizzle } from "../../../../src/client/database/drizzle.ts";
import { migrations, schema } from "../db.ts";

export const queryClient = new QueryClient();

export const sqlite = await createSqliteWasmDb();
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
});
