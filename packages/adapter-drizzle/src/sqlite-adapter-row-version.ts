import {
    SQLiteTransaction,
    integer,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";
import { RowVersionDbAdapter } from "@relic/server";
import { eq, lt, sql } from "drizzle-orm";

const clientViews = sqliteTable("relic_client_views", {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", {
        mode: "timestamp",
    }).default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
    data: text("data").notNull(),
});

function minusDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
}

export function rowVersionDrizzleSqliteAdapter() {
    return {
        getClientView: async (tx, id) => {
            const str = await tx
                .select()
                .from(clientViews)
                .where(eq(clientViews.id, id))
                .get()?.view;
            return str ? JSON.parse(str) : undefined;
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
