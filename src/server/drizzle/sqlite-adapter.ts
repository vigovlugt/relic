/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BaseSQLiteDatabase,
    SQLiteColumn,
    SQLiteTableWithColumns,
    SQLiteTransaction,
} from "drizzle-orm/sqlite-core";
import { RelicServerDatabase } from "../relic-server-database";
import { eq } from "drizzle-orm";

export function sqliteAdapter(
    db: BaseSQLiteDatabase<any, any, any>,
    clientsTable: SQLiteRelicClientsTable
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
}

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
