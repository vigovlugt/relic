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
            delete: string[];
        }
    >;
};
