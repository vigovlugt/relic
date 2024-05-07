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
        // A database column can be called differently than the JS object property, e.g. is_done in sqlite -> isDone in js
        const jsNameByDbName = Object.fromEntries(
            Object.entries(tableSchema).map(([k, v]) => [v.name, k])
        );

        for (const row of rows.delete) {
            // TODO: make composite primary keys possible
            const sql = `DELETE FROM ${name} WHERE id = ?`;
            const params = [row];
            await db.exec(sql, params);
        }

        // TODO: batch for performance
        // TODO: map driver values: timestamp_ms: int -> string
        for (const row of rows.put) {
            const sql = `INSERT OR REPLACE INTO ${name} (${table.columns
                .map((c) => c.name)
                .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
            const params = columns.map((c) =>
                transformValue(c, row[jsNameByDbName[c.name]])
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
