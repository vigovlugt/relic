import {
    PgTransaction,
    uuid,
    pgTable,
    timestamp,
    json,
} from "drizzle-orm/pg-core";
import { RowVersionDbAdapter } from "@relic/server";
import { eq, lt } from "drizzle-orm";
import { minusDays } from "./utils";

const clientViews = pgTable("relic_client_views", {
    id: uuid("id").primaryKey(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    data: json("data").notNull(),
});

export function rowVersionPostgresAdapter() {
    return {
        getClientView: async (tx, id) => {
            const data = await tx
                .select({ data: clientViews.data })
                .from(clientViews)
                .where(eq(clientViews.id, id))
                .limit(1)
                .execute();

            return data.at(0)?.data;
        },
        createClientView: async (tx, id, view) => {
            await tx.insert(clientViews).values({
                id,
                data: JSON.stringify(view),
            });
        },
        deleteClientViews: async (tx) => {
            // Delete all client views older than 7 days
            // Not perfect, but good enough
            await tx
                .delete(clientViews)
                .where(lt(clientViews.createdAt, minusDays(new Date(), 7)));
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as RowVersionDbAdapter<PgTransaction<any, any, any>>;
}
