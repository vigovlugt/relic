import { config } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrations, drizzleSchema } from "./db";
import { handleRelicRequest } from "@relic/server";
import { relicServer } from "./relic";
import { postgresAdapter } from "@relic/adapter-drizzle";
import EventEmitter from "events";
import { showRoutes } from "hono/dev";

config();

export const pool = new Pool({
    connectionString: process.env.POSTGRES_CONNECTION_STRING,
    // "postgres://user:password@host:port/db",
});
export const db = drizzle(pool, {
    schema: drizzleSchema,
});

const pokeEmitter = new EventEmitter();

const app = new Hono();
app.use("*", cors());
app.post("/relic/*", (c) => {
    const user = c.req.query("user");
    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    return handleRelicRequest({
        relicServer,
        req: c.req.raw,
        context: {
            user,
            pokeEmitter,
        },
        database: postgresAdapter(db),
    });
});
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

async function main() {
    await pool.query(migrations);

    const port = 3000;
    console.log(`Server is running on http://localhost:${port}`);
    showRoutes(app);
    serve({
        fetch: app.fetch,
        port,
    });
}
main();
