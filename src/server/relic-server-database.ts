export type RelicServerDatabaseClient = {
    id: string;
    mutationId: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RelicServerDatabase<TTx = any> = {
    transaction: <T>(callback: (tx: TTx) => Promise<T>) => Promise<T>;
    getClient: (
        tx: TTx,
        clientId: string
    ) => Promise<RelicServerDatabaseClient | undefined>;
    updateClient: (
        tx: TTx,
        clientId: string,
        mutationId: number
    ) => Promise<void>;
    createClient: (tx: TTx, clientId: string) => Promise<void>;
};
