import { SqliteDb } from ".";
import { SQLiteColumn, getTableConfig } from "drizzle-orm/sqlite-core";
import { RelicPullResponse } from "../../shared/pull";
import { RelicSchema } from "../../shared/relic-definition-builder";

export async function applyPullData(
    db: SqliteDb,
    schema: RelicSchema,
    pullResponse: RelicPullResponse
) {
    const { clear, entities } = pullResponse.data;
    if (clear) {
        for (const table of Object.values(schema)) {
            const { name } = getTableConfig(table);
            await db.exec(`DELETE FROM ${name}`);
        }
    }

    for (const [tableName, rows] of Object.entries(entities)) {
        const tableSchema = schema[tableName];
        if (!tableSchema) {
            throw new Error(`Table ${tableName} not found in schema`);
        }

        const table = getTableConfig(tableSchema);
        const { columns, name } = table;
        // A database column can be called differently than the JSON object property, e.g. is_done in sqlite -> isDone in js
        const jsonNameByDbName = Object.fromEntries(
            Object.entries(tableSchema).map(([k, v]) => [v.name, k])
        );

        // Delete rows that are marked for deletion
        if (rows.delete.length > 0) {
            const type = typeof rows.delete[0];

            // Composite primary keys are objects
            if (type === "object") {
                const rowsToDelete = rows.delete as Record<string, unknown>[];
                const pk = table.primaryKeys[0];
                if (!pk) {
                    throw new Error(
                        `Table ${name} has no composite primary key`
                    );
                }

                for (const row of rowsToDelete) {
                    const sql = `DELETE FROM ${name} WHERE ${pk.columns
                        .map((c) => `${c.name} = ?`)
                        .join(" AND ")}`;
                    const params = pk.columns.map((c) =>
                        transformValue(c, row[jsonNameByDbName[c.name]])
                    );
                    await db.exec(sql, params);
                }
            } else {
                // Single primary keys are values
                const rowsToDelete = rows.delete as unknown[];

                const pkColumn = columns.find((c) => c.primary);
                if (!pkColumn) {
                    throw new Error(`Table ${name} has no primary key`);
                }

                for (const row of rowsToDelete) {
                    // TODO: make composite primary keys possible
                    const sql = `DELETE FROM ${name} WHERE ${pkColumn.name} = ?`;
                    const params = [transformValue(pkColumn, row)];
                    await db.exec(sql, params);
                }
            }
        }

        // Insert or replace new and updated rows
        // TODO: batch to avoid worker <-> main thread overhead
        for (const row of rows.put) {
            const sql = `INSERT OR REPLACE INTO ${name} (${table.columns
                .map((c) => c.name)
                .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
            const params = columns.map((c) =>
                transformValue(c, row[jsonNameByDbName[c.name]])
            );
            await db.exec(sql, params);
        }
    }
}

function transformValue(column: SQLiteColumn, value: unknown) {
    // SQLiteTimestamps are mapped from Date objects to json in network transfer, so we need to convert them back
    if (column.columnType === "SQLiteTimestamp" && typeof value === "string") {
        value = new Date(value);
    }

    // This maps a JS value to a driver value, such as Date -> number
    return column.mapToDriverValue(value);
}
