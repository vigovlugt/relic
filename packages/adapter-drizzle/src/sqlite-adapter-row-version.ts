import {
    SQLiteTransaction,
    integer,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";
import { RowVersionDbAdapter } from "@relic/server";
import { eq, lt, sql } from "drizzle-orm";
import { minusDays } from "./utils";

const clientViews = sqliteTable("relic_client_views", {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", {
        mode: "timestamp",
    }).default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    data: text("data").notNull(),
});

export function rowVersionSqliteAdapter() {
    return {
        getClientView: async (tx, id) => {
            const data = await tx
                .select({ data: clientViews.data })
                .from(clientViews)
                .where(eq(clientViews.id, id))
                .limit(1)
                .execute();

            if (data.length === 0) {
                return undefined;
            }

            return JSON.parse(data[0]!.data);
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
    } as RowVersionDbAdapter<SQLiteTransaction<any, any, any, any>>;
}
