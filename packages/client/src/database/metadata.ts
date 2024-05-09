import { SqliteDb } from ".";

export type RelicClientMetadata = {
    clientId: string;
    version: string;
};

export class MetadataManager {
    db: SqliteDb;
    tableName: string;

    constructor(db: SqliteDb, tableName: string) {
        this.db = db;
        this.tableName = tableName;
    }

    async setup() {
        await this.db.exec(
            `CREATE TABLE IF NOT EXISTS ${this.tableName} (key TEXT PRIMARY KEY, value TEXT);
            INSERT OR IGNORE INTO ${this.tableName} (key, value) VALUES ('clientId', ?);
            INSERT OR IGNORE INTO ${this.tableName} (key, value) VALUES ('version', '0')
            `,
            [crypto.randomUUID()]
        );
    }

    async getAll() {
        const { rows } = await this.db.exec(`SELECT * FROM ${this.tableName}`);

        return Object.fromEntries(
            rows.map((row) => {
                return [row[0], row[1]];
            })
        ) as RelicClientMetadata;
    }

    async get(key: keyof RelicClientMetadata) {
        const { rows } = await this.db.exec(
            `SELECT value FROM ${this.tableName} WHERE key = ?`,
            [key]
        );

        return rows[0]![0] as string;
    }

    async set(key: string, value: string) {
        await this.db.exec(
            `INSERT OR REPLACE INTO ${this.tableName} (key, value) VALUES (?, ?)`,
            [key, value]
        );
    }
}
