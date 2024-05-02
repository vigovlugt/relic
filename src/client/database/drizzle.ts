import { drizzle as _drizzle } from "drizzle-orm/sqlite-proxy";
import { SqliteDb } from ".";

export function drizzle(db: SqliteDb) {
    return _drizzle(async (sql, params, method) => {
        const result = await db.exec(sql, params);
        if (method === "get") {
            return {
                rows: result.rows.length > 0 ? result.rows[0] : [],
            };
        }

        return result;
    });
}
