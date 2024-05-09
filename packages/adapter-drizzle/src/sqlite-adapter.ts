/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BaseSQLiteDatabase,
    SQLiteColumn,
    SQLiteTableWithColumns,
    SQLiteTransaction,
    integer,
    sqliteTable,
    text,
} from "drizzle-orm/sqlite-core";
import { RelicServerDatabase } from "@relic/server";
import { eq } from "drizzle-orm";

// TODO: extract transaction from schema, not db object
export type ExtractTransaction<
    TDB extends BaseSQLiteDatabase<any, any, any, any>
> = Parameters<Parameters<TDB["transaction"]>[0]>[0];

export function sqliteAdapter(
    db: BaseSQLiteDatabase<any, any, any>,
    clientsTable: SQLiteRelicClientsTable = DEFAULT_CLIENTS
): RelicServerDatabase<SQLiteTransaction<any, any, any, any>> {
    return {
        transaction: async (fn) => {
            return await db.transaction(fn);
        },
        getClient: async (tx, clientId) =>
            await tx
                .select()
                .from(clientsTable)
                .where(eq(clientsTable.id, clientId))
                .get(),
        createClient: async (tx, clientId) =>
            await tx.insert(clientsTable).values({
                id: clientId,
                mutationId: 0,
            }),
        updateClient: async (tx, clientId, mutationId) =>
            await tx
                .update(clientsTable)
                .set({
                    mutationId,
                })
                .where(eq(clientsTable.id, clientId)),
    };
    // TODO: Move row version stuff here maybe good idea? Maybe not
}

const DEFAULT_CLIENTS = sqliteTable("relic_clients", {
    id: text("id").primaryKey(),
    mutationId: integer("mutation_id").notNull(),
});

export type SQLiteRelicClientsTable = SQLiteTableWithColumns<{
    dialect: "sqlite";
    columns: {
        id: SQLiteColumn<
            {
                name: any;
                tableName: any;
                dataType: any;
                columnType: any;
                data: string;
                driverParam: any;
                notNull: true;
                hasDefault: boolean;
                enumValues: any;
                baseColumn: any;
            },
            object
        >;
        mutationId: SQLiteColumn<
            {
                name: any;
                tableName: any;
                dataType: any;
                columnType: any;
                data: number;
                driverParam: any;
                notNull: true;
                hasDefault: boolean;
                enumValues: any;
                baseColumn: any;
            },
            object
        >;
    };
    schema: any;
    name: any;
}>;
