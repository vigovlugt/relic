import { reservations, rooms } from "@mrs/shared";
import { setupRelic } from "./relic";
import { Bench } from "tinybench";
import { count, eq } from "drizzle-orm";

declare global {
    interface Window {
        relic: any;
        sqlite: any;
    }
}

async function benchmark(rows: number) {
    const startupBench = new Bench({ time: 1000, iterations: 1 });

    startupBench.add(
        "setup relic new",
        async () => {
            const { relic, sqlite } = await setupRelic(rows);
            window.relic = relic;
            window.sqlite = sqlite;
            await relic.currentPull;
        },
        {
            async afterEach() {
                await window.relic.destroy();
                await window.sqlite.close();
                await window.sqlite.remove();
                await window.sqlite.terminate();
            },
        }
    );

    startupBench.add(
        "setup relic existing",
        async () => {
            const { relic, sqlite } = await setupRelic(rows);
            window.relic = relic;
            window.sqlite = sqlite;
        },
        {
            async beforeEach() {
                const { relic: r, sqlite: s } = await setupRelic(rows);
                await r.currentPull;
                await r.destroy();
                await s.close();
                await s.terminate();
            },
            async afterEach() {
                await window.relic.currentPull;
                await window.relic.destroy();
                await window.sqlite.close();
                await window.sqlite.remove();
                await window.sqlite.terminate();
            },
        }
    );

    await startupBench.warmup();
    await startupBench.run();

    const bench = new Bench({ time: 1000 });
    const { db, relic, sqlite } = await setupRelic(rows);
    await relic.currentPull;

    const limits = [1, 10, 100];

    for (const limit of limits) {
        bench.add("select limit " + limit, async () => {
            await relic.fetchQuery(db.select().from(reservations).limit(limit));
        });
    }

    bench.add("select join", async () => {
        await relic.fetchQuery(
            db
                .select()
                .from(reservations)
                .innerJoin(rooms, eq(reservations.roomId, rooms.id))
                .limit(10)
        );
    });

    const reservationIds = await db
        .select({ id: reservations.id })
        .from(reservations)
        .then((rows) => rows?.map((row) => row.id) ?? []);
    const roomIds = await db
        .select({ id: rooms.id })
        .from(rooms)
        .then((rows) => rows?.map((row) => row.id) ?? []);

    bench.add("update reservation", async () => {
        const id =
            reservationIds[Math.floor(Math.random() * reservationIds.length)];
        await relic.mutate.updateReservation({
            id,
            start: new Date(),
            end: new Date(),
        });
    });

    let previousId: string | undefined;
    bench.add(
        "create reservation",
        async () => {
            const id = crypto.randomUUID();
            previousId = id;
            await relic.mutate.createReservation({
                id,
                roomId: roomIds[Math.floor(Math.random() * roomIds.length)],
                start: new Date(),
                end: new Date(),
            });
        },
        {
            async afterEach() {
                await relic.mutate.deleteReservation(previousId!);
            },
        }
    );

    bench.add(
        "delete reservation",
        async () => {
            await relic.mutate.deleteReservation(previousId!);
        },
        {
            async beforeEach() {
                const id = crypto.randomUUID();
                previousId = id;
                await relic.mutate.createReservation({
                    id,
                    roomId: roomIds[Math.floor(Math.random() * roomIds.length)],
                    start: new Date(),
                    end: new Date(),
                });
            },
        }
    );

    await bench.warmup();
    await bench.run();

    relic.destroy();
    await sqlite.close();
    await sqlite.remove();
    await sqlite.terminate();

    console.log("Rows: " + rows);
    console.table();
    console.table([...startupBench.table(), ...bench.table()]);
    document.body.innerHTML += `<h1>Rows: ${rows}</h1>`;

    return Object.fromEntries([
        ...startupBench.tasks.map((task, i) => [
            task.name,
            startupBench.results[i],
        ]),
        ...bench.tasks.map((task, i) => [task.name, bench.results[i]]),
    ]);
}

async function main() {
    const opfsRoot = await navigator.storage.getDirectory();
    (opfsRoot as any).remove();

    let rows = [1, 10, 100, 1000, 10000, 100000];
    // rows = [1_000_000];
    const results = [];
    for (const row of rows) {
        const result = await benchmark(row);
        // await new Promise((resolve) => setTimeout(resolve, 3000));
        results.push(result);
    }

    console.log("Results:");
    console.log(
        Object.fromEntries(results.map((result, i) => [rows[i], result]))
    );
    window.document.body.innerHTML =
        "<pre>" +
        JSON.stringify(
            Object.fromEntries(results.map((result, i) => [rows[i], result])),
            null,
            2
        ) +
        "</pre>";
}
main();
