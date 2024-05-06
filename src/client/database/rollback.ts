import { SqliteDb } from ".";

export class RollbackManager {
    db: SqliteDb;
    rollbackTable: string;

    active: boolean = false;

    constructor(db: SqliteDb, rollbackTable: string) {
        this.db = db;
        this.rollbackTable = rollbackTable;
    }

    async setup() {
        if (this.active) {
            return;
        }
        this.active = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let promises: Promise<any>[] = [];
        promises.push(
            this.db.exec(
                `CREATE TABLE IF NOT EXISTS ${this.rollbackTable} (id INTEGER PRIMARY KEY, sql TEXT)`
            )
        );

        const tables = (
            await this.db.exec(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        ).rows
            .map((r) => r[0] as string)
            .filter((name) => !name.startsWith("_"));

        promises = promises.concat(
            tables.map(async (table) => {
                const columns = (
                    await this.db.exec(`pragma table_info(${table})`)
                ).rows.map(
                    (r) => r[1] // take the name column
                );

                const sql = `CREATE TEMP TRIGGER ${
                    this.rollbackTable
                }_${table}_on_insert AFTER INSERT ON ${table} BEGIN
    INSERT INTO ${
        this.rollbackTable
    } VALUES (NULL, 'DELETE FROM ${table} WHERE rowid=' || new.rowid);
END;
CREATE TEMP TRIGGER ${
                    this.rollbackTable
                }_${table}_on_update AFTER UPDATE ON ${table} BEGIN
    INSERT INTO ${
        this.rollbackTable
    } VALUES (NULL, 'UPDATE ${table} SET ${columns
                    .map((name) => `${name}=' || quote(old.${name}) || '`)
                    .join(", ")} WHERE rowid=' || old.rowid);
END;
CREATE TEMP TRIGGER ${
                    this.rollbackTable
                }_${table}_on_delete BEFORE DELETE ON ${table} BEGIN
    INSERT INTO ${
        this.rollbackTable
    } VALUES(NULL, 'INSERT INTO ${table} (rowid${columns
                    .map((name) => `, ${name}`)
                    .join("")}) VALUES (' || old.rowid || '${columns
                    .map((name) => `, ' || quote(old.${name}) || '`)
                    .join("")})');
END;`;
                return await this.db.exec(sql);
            })
        );

        await Promise.all(promises);
    }

    async clear() {
        await this.db.exec(`DELETE FROM ${this.rollbackTable}`);
    }

    async getAll() {
        const { rows } = await this.db.exec(
            `SELECT * FROM ${this.rollbackTable}`
        );

        return rows;
    }

    async rollback() {
        const { rows } = await this.db.exec(
            `SELECT sql FROM ${this.rollbackTable} ORDER BY id DESC`
        );

        // Run all rollback commands
        if (rows.length) {
            await this.db.exec(rows.map((r) => r[0]).join(";"));
        }

        await this.clear();
    }
}
