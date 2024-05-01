// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqliteParams = any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqliteRows = any[][];

export type SqliteExecResult = {
    rows: SqliteRows;
};

export interface SqliteDb {
    exec: (sql: string, params?: SqliteParams) => Promise<SqliteExecResult>;
}
