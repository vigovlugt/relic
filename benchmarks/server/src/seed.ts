import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { reservations } from "./rest/db";

export async function seed(db: NodePgDatabase<any>, rows: number) {
    await db.delete(reservations).execute();

    const batchSize = 10000;
    const totalBatches = Math.ceil(rows / batchSize);
    const rowsPerBatch = Math.ceil(rows / totalBatches);

    for (let i = 0; i < totalBatches; i++) {
        const batchValues = Array.from({ length: rowsPerBatch }).map(
            (_, j) => ({
                id: crypto.randomUUID(),
                roomId: [
                    "00000000-0000-0000-0000-000000000000",
                    "00000000-0000-0000-0000-000000000001",
                    "00000000-0000-0000-0000-000000000002",
                ][(i * batchSize + j) % 3],
                owner: "Alice",
                start: new Date(),
                end: new Date(),
            })
        );

        await db.insert(reservations).values(batchValues);
    }
}
