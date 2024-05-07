export type RelicPullRequest = {
    clientId: string;
    version: number;
};

export type RelicPullResponse = {
    data: RelicPullData;
    lastProcessedMutationId: number;
    version: number;
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
};
