import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { relicRequestHandler } from "../../../../src/server/relic-request-handler";
import { sqliteAdapter } from "../../../../src/server/drizzle/sqlite-adapter";
import { EventEmitter } from "events";
import { migrations, schema } from "./db";
import { relicServer } from "./relic";

export const sqlite = new Database("sqlite.db");
export const db = drizzle(sqlite, {
    schema,
});

sqlite.exec(migrations);

const pokeEmitter = new EventEmitter();
const app = new Hono();
app.use("*", cors());
app.post("/relic/*", async (c) =>
    relicRequestHandler({
        relicServer,
        req: c.req.raw,
        context: {
            pokeEmitter,
        },
        database: sqliteAdapter(db),
    })
);
app.get("/relic/poke", (c) => {
    return streamSSE(c, async (stream) => {
        pokeEmitter.on("poke", async () => {
            await stream.writeSSE({
                data: "",
            });
        });

        await new Promise((resolve) => {
            pokeEmitter.on("end", resolve);
        });
    });
});
serve({
    fetch: app.fetch,
    port: 3000,
});

console.log("Server running on http://localhost:3000");
