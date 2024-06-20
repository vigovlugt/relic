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
import { eq } from "drizzle-orm";

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

let inflightRelicRequests = 0;

const app = new Hono();
app.use("*", cors());
app.post("/relic/*", async (c) => {
    inflightRelicRequests++;
    const user = c.req.query("user");
    if (!user) {
        inflightRelicRequests--;
        return new Response("Unauthorized", { status: 401 });
    }

    const res = await handleRelicRequest({
        relicServer,
        req: c.req.raw,
        context: {
            user,
            pokeEmitter,
        },
        database: postgresAdapter(db),
    });

    inflightRelicRequests--;
    return res;
});
app.get("/relic/poke", (c) =>
    streamSSE(c, async (stream) => {
        pokeEmitter.on("poke", async () => {
            await stream.writeSSE({
                data: "",
            });
        });

        await new Promise((resolve) => {
            pokeEmitter.on("end", resolve);
        });
    })
);
app.post("/rows", async (c) => {
    const rows = c.req.query("rows");
    if (!rows) {
        return new Response("Missing rows", { status: 400 });
    }

    await seed(db, +rows);
    console.log("Database seeded with " + rows + " rows");

    return new Response();
});
app.post("/changes", async (c) => {
    const changes = c.req.query("changes");
    if (!changes) {
        return new Response("Missing changes", { status: 400 });
    }

    for (let i = 0; i < +changes; i++) {
        await db.insert(drizzleSchema.reservations).values({
            id: crypto.randomUUID(),
            roomId: "00000000-0000-0000-0000-000000000000",
            owner: "Changes",
            start: new Date(),
            end: new Date(),
        });
    }
    console.log("Database changes set to " + changes + " changes");

    return new Response();
});
app.delete("/changes", async (c) => {
    const res = await db
        .delete(drizzleSchema.reservations)
        .where(eq(drizzleSchema.reservations.owner, "Changes"))
        .execute();
    console.log("Database changes deleted n=", res.rowCount);
    return new Response();
});

app.get("/wait-for-inflight", async (c) => {
    while (inflightRelicRequests > 0) {
        console.log(
            "Waiting for",
            inflightRelicRequests,
            "inflight requests to finish"
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("All inflight requests finished");
    return new Response();
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
