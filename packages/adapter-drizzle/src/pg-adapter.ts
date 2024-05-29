/* eslint-disable @typescript-eslint/no-explicit-any */
import { RelicServerDatabase } from "@relic/server";
import { eq } from "drizzle-orm";
import {
    PgColumn,
    PgDatabase,
    PgTableWithColumns,
    PgTransaction,
    integer,
    pgTable,
    uuid,
} from "drizzle-orm/pg-core";

export function postgresAdapter(
    db: PgDatabase<any, any, any>,
    clientsTable: PgRelicClientsTable = DEFAULT_CLIENTS
): RelicServerDatabase<PgTransaction<any, any, any>> {
    return {
        transaction: async (fn) => {
            return await db.transaction(fn);
        },
        getClient: async (tx, clientId) =>
            (
                await tx
                    .select()
                    .from(clientsTable)
                    .where(eq(clientsTable.id, clientId))
            ).at(0),
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

const DEFAULT_CLIENTS = pgTable("relic_clients", {
    id: uuid("id").primaryKey(),
    mutationId: integer("mutation_id").notNull(),
});

export type PgRelicClientsTable = PgTableWithColumns<{
    dialect: "pg";
    columns: {
        id: PgColumn<
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
        mutationId: PgColumn<
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
