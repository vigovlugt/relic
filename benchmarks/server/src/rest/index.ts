import { config } from "dotenv";
config();
import { schema, migrations, reservations } from "./db";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import EventEmitter from "events";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, or, lt, gt } from "drizzle-orm";
import { seed } from "../seed";

if (process.env.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be production");
}

const realtime = process.env.REALTIME === "true";
if (!process.env.ROWS) {
    throw new Error("ROWS is not set");
}
const rows = +process.env.ROWS;

const pool = new Pool({
    connectionString: process.env.REST_POSTGRES_CONNECTION_STRING,
});
const db = drizzle(pool, {
    schema,
});

type ExtractTransaction<
    TDB extends {
        transaction: (fn: (tx: any) => any) => any;
    },
> = Parameters<Parameters<TDB["transaction"]>[0]>[0];
type Tx = ExtractTransaction<typeof db>;

const realtimeEmitter = realtime ? new EventEmitter() : null;

const app = new Hono();
app.use("*", cors());
app.get("/rooms", async (c) => {
    const user = c.req.query("user");
    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    return c.json(await db.select().from(schema.rooms));
});
app.get("/reservations", async (c) => {
    const user = c.req.query("user");
    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    return c.json(await db.select().from(schema.reservations).limit(10));
});
async function getConflictingReservations(
    tx: Tx,
    roomId: string,
    start: Date,
    end: Date
) {
    return await tx
        .select()
        .from(reservations)
        .where(
            and(
                eq(reservations.roomId, roomId),
                or(
                    and(
                        lt(reservations.start, new Date(end)),
                        gt(reservations.end, new Date(start))
                    ),
                    and(
                        eq(reservations.start, new Date(end)),
                        eq(reservations.end, new Date(start))
                    )
                )
            )
        );
}

app.post(
    "/reservations",
    zValidator(
        "json",
        z.object({
            id: z.string(),
            roomId: z.string(),
            start: z.coerce.date(),
            end: z.coerce.date(),
        })
    ),
    async (c) => {
        const user = c.req.query("user");
        if (!user) {
            return new Response("Unauthorized", { status: 401 });
        }

        const input = c.req.valid("json");

        await db.transaction(async (tx) => {
            const conflicts = await getConflictingReservations(
                tx,
                input.roomId,
                input.start,
                input.end
            );
            if (conflicts.length) {
                return;
            }

            await tx.insert(schema.reservations).values({
                ...input,
                owner: user,
            });
        });
    }
);
app.put(
    "/reservations/:id",
    zValidator(
        "json",
        z.object({
            id: z.string(),
            start: z.coerce.date().optional(),
            end: z.coerce.date().optional(),
        })
    ),
    async (c) => {
        const user = c.req.query("user");
        if (!user) {
            return new Response("Unauthorized", { status: 401 });
        }

        const input = c.req.valid("json");
        await db
            .update(reservations)
            .set(input)
            .where(eq(reservations.id, input.id));
    }
);
app.delete("/reservations/:id", zValidator("json", z.string()), async (c) => {
    const user = c.req.query("user");
    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const id = c.req.valid("json");

    await db.delete(reservations).where(eq(reservations.id, id));

    if (realtime) {
        realtimeEmitter!.emit("poke");
    }
});

if (realtime) {
    app.get("/sse", (c) => {
        return streamSSE(c, async (stream) => {
            realtimeEmitter!.on("poke", async () => {
                await stream.writeSSE({
                    data: "",
                });
            });

            await new Promise((resolve) => {
                realtimeEmitter!.on("end", resolve);
            });
        });
    });
}

async function main() {
    console.log({
        benchmark: "rest",
        rows,
    });
    await pool.query(migrations);
    await seed(db, rows);

    const port = 3000;
    console.log(`Server is running on http://localhost:${port}`);
    serve({
        fetch: app.fetch,
        port,
    });
}
main();
