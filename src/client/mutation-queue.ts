import { SqliteDb } from "./database";
import { Mutation } from "./mutation";

export class MutationQueue {
    db: SqliteDb;
    tableName: string;

    constructor(db: SqliteDb, tableName: string) {
        this.db = db;
        this.tableName = tableName;
    }

    async setup() {
        await this.db.exec(
            `CREATE TABLE IF NOT EXISTS ${this.tableName} (id INTEGER PRIMARY KEY, type TEXT, input TEXT)`
        );
    }

    async getAll() {
        const { rows } = await this.db.exec(`SELECT * FROM ${this.tableName}`);

        return rows.map((row) => {
            return {
                id: row[0] as number,
                type: row[1] as string,
                input: JSON.parse(row[2] as string),
            };
        });
    }

    async add(mutation: Omit<Mutation, "id">) {
        const { rows } = await this.db.exec(
            `INSERT INTO ${this.tableName} (type, input) VALUES (?, ?) RETURNING id`,
            [mutation.type, JSON.stringify(mutation.input)]
        );

        const id = rows[0][0] as string;

        return id;
    }

    async deleteUpTo(maxId: number) {
        await this.db.exec(`DELETE FROM ${this.tableName} WHERE id <= ?`, [
            maxId,
        ]);
    }
}
