import {
    SQLiteTransaction,
    integer,
    primaryKey,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";
import { RowVersionDbAdapter } from "./row-version";
import { and, eq, lte } from "drizzle-orm";

const clientViews = sqliteTable(
    "relic_client_views",
    {
        clientId: text("client_id").notNull(),
        viewId: integer("view_id").notNull(),
        view: text("view").notNull(),
    },
    (t) => ({
        pk: primaryKey({
            columns: [t.clientId, t.viewId],
        }),
    })
);

export function rowVersionDrizzleSqliteAdapter() {
    return {
        getClientView: async (tx, clientId, viewId) => {
            const str = tx
                .select()
                .from(clientViews)
                .where(
                    and(
                        eq(clientViews.clientId, clientId),
                        eq(clientViews.viewId, viewId)
                    )
                )
                .get()?.view;
            return str ? JSON.parse(str) : undefined;
        },
        createClientView: (tx, clientId, viewId, view) => {
            tx.insert(clientViews)
                .values({
                    clientId,
                    viewId,
                    view: JSON.stringify(view),
                })
                .execute();
        },
        deleteClientViews: (tx, clientId: string, maxViewId: number) => {
            tx.delete(clientViews).where(
                and(
                    eq(clientViews.clientId, clientId),
                    lte(clientViews.viewId, maxViewId)
                )
            );
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as RowVersionDbAdapter<SQLiteTransaction<any, any, any, any>>;
}
