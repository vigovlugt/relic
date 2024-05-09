export type RelicPullRequest = {
    clientId: string;
    version: string | null;
};

export type RelicPullResponse = {
    data: RelicPullData;
    lastProcessedMutationId: number;
};

export type RelicPullData = {
    clear: boolean;
    entities: Record<
        string,
        {
            put: Record<string, unknown>[];
            // A key is a value, such as 1, or a object for composite keys: { todoId: 1, userId: 2 }
            delete: unknown[] | Record<string, unknown>[];
        }
    >;
    version: string;
};
