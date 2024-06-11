import { createSqliteWasmDb } from "@relic/sqlite-wasm";
import SqliteWasmWorker from "@relic/sqlite-wasm/worker?worker";
import { drizzle, createRelicClient } from "@relic/client";
import { QueryClient } from "@tanstack/query-core";
import { drizzleSchema, migrations } from "@mrs/shared";
import { relicClient } from "@mrs/client/client";

export async function setupRelic(rows: number) {
    const queryClient = new QueryClient();
    const sqlite = await createSqliteWasmDb(new SqliteWasmWorker());
    await sqlite.exec(migrations);
    const db = drizzle(sqlite, {
        schema: drizzleSchema,
    });

    const url =
        import.meta.env.VITE_SERVER_URL ??
        "http://localhost:3000/relic?user=John%20Doe";

    const relic = await createRelicClient({
        relicClient,
        queryClient,
        db,
        sqlite,
        url,
        context: {
            user: "John Doe",
        },
        pusher: async () => {
            return undefined;
        },
        puller: async () => {
            return {
                data: {
                    clear: true,
                    entities: {
                        rooms: {
                            set: [
                                {
                                    id: "00000000-0000-0000-0000-000000000000",
                                    name: "Room 1",
                                },
                                {
                                    id: "00000000-0000-0000-0000-000000000001",
                                    name: "Room 2",
                                },
                                {
                                    id: "00000000-0000-0000-0000-000000000002",
                                    name: "Room 3",
                                },
                            ],
                            delete: [],
                        },
                        reservations: {
                            set: Array.from({ length: rows }, (_, i) => ({
                                id: crypto.randomUUID(),
                                roomId: [
                                    "00000000-0000-0000-0000-000000000000",
                                    "00000000-0000-0000-0000-000000000001",
                                    "00000000-0000-0000-0000-000000000002",
                                ][i % 3],
                                owner: "John Doe",
                                start: new Date(),
                                end: new Date(),
                            })),
                            delete: [],
                        },
                    },
                    version: crypto.randomUUID(),
                },
                lastProcessedMutationId: 100000000,
            };
        },
        poker: () => () => {},
    });

    return {
        db,
        relic,
        queryClient,
        sqlite,
    };
}
