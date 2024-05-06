import { SqliteDb } from ".";
import { SQLiteTransaction, getTableConfig } from "drizzle-orm/sqlite-core";
import { RelicPullResponse } from "../../shared/pull";
import { RelicSchema } from "../../shared/relic-definition-builder";

export async function applyPullData(
    db: SqliteDb,
    schema: RelicSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: SQLiteTransaction<any, any, any, any>,
    pullResponse: RelicPullResponse
) {
    for (const [tableName, rows] of Object.entries(pullResponse.data)) {
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

        // TODO: batch for performance
        for (const row of rows) {
            const sql = `INSERT OR REPLACE INTO ${name} (${table.columns
                .map((c) => c.name)
                .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
            const params = columns.map((c) => row[jsNameByDbName[c.name]]);
            console.log(sql, params);
            await db.exec(sql, params);
        }
    }
}
