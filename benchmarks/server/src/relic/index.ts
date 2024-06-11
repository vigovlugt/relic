import { config } from "dotenv";
config();
import { drizzleSchema, migrations } from "@mrs/server/db";
import { relicServer } from "@mrs/server/relic";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { handleRelicRequest } from "@relic/server";
import { postgresAdapter } from "@relic/adapter-drizzle";
import EventEmitter from "events";
import { seed } from "../seed";

if (process.env.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be production");
}

if (!process.env.ROWS) {
    throw new Error("ROWS is not set");
}
const rows = +process.env.ROWS;

console.log(process.env.RELIC_POSTGRES_CONNECTION_STRING);
export const pool = new Pool({
    connectionString: process.env.RELIC_POSTGRES_CONNECTION_STRING,
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
    console.log({
        benchmark: "relic",
        rows,
    });
    await pool.query(migrations);
    console.log("Database migrated");
    await seed(db, rows);
    console.log("Database seeded");

    const port = 3000;
    console.log(`Server is running on http://localhost:${port}`);
    serve({
        fetch: app.fetch,
        port,
    });
}
main();
