import { SqliteDb, SqliteParams } from ".";
import { SQLiteColumn, getTableConfig } from "drizzle-orm/sqlite-core";
import { RelicPullResponse, RelicSchema } from "@relic/core";

export async function applyPullData(
    db: SqliteDb,
    schema: RelicSchema,
    pullResponse: RelicPullResponse
) {
    const { clear, entities } = pullResponse.data;
    if (clear) {
        db.execBatch(
            Object.values(schema).map((table) => [
                `DELETE FROM ${getTableConfig(table).name}`,
                undefined,
            ])
        );
    }

    const execs: [string, SqliteParams | undefined][] = [];

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

                execs.push([
                    `DELETE FROM ${name} WHERE ${pk.columns
                        .map((c) => `${c.name} = ?`)
                        .join(" AND ")};`,
                    rowsToDelete.map((row) =>
                        pk.columns.map((c) =>
                            transformValue(c, row[jsonNameByDbName[c.name]])
                        )
                    ),
                ]);
            } else {
                // Single primary keys are values
                const rowsToDelete = rows.delete as unknown[];

                const pkColumn = columns.find((c) => c.primary);
                if (!pkColumn) {
                    throw new Error(`Table ${name} has no primary key`);
                }

                execs.push([
                    `DELETE FROM ${name} WHERE ${pkColumn.name} = ?;`,
                    rowsToDelete.map((row) => transformValue(pkColumn, row)),
                ]);
            }
        }

        // Insert or replace new and updated rows
        for (const row of rows.set) {
            const sql = `INSERT OR REPLACE INTO ${name} (${columns
                .map((c) => c.name)
                .join(", ")}) VALUES (${columns.map(() => "?").join(", ")});`;
            const params = columns.map((c) =>
                transformValue(c, row[jsonNameByDbName[c.name]])
            );
            execs.push([sql, params]);
        }
    }

    // Do all execs in one worker message to avoid multiple round trips
    await db.execBatch(execs);
}

function transformValue(column: SQLiteColumn, value: unknown) {
    // SQLiteTimestamps are mapped from Date objects to json in network transfer, so we need to convert them back
    if (column.columnType === "SQLiteTimestamp" && typeof value === "string") {
        value = new Date(value);
    }

    // This maps a JS value to a driver value, such as Date -> number
    return column.mapToDriverValue(value);
}
