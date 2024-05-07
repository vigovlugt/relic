import { drizzle as _drizzle } from "drizzle-orm/sqlite-proxy";
import { SqliteDb } from ".";
import { DrizzleConfig } from "drizzle-orm";

export function drizzle<
    TSchema extends Record<string, unknown> = Record<string, never>
>(db: SqliteDb, config?: DrizzleConfig<TSchema> | undefined) {
    return _drizzle(async (sql, params, method) => {
        const result = await db.exec(sql, params);
        if (method === "get") {
            return {
                rows: result.rows.length > 0 ? result.rows[0] : [],
            };
        }

        return result;
    }, config);
}
