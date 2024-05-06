export type RelicPullRequest = {
    clientId: string;
    version: number;
};

export type RelicPullResponse = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any[]>;
    lastProcessedMutationId: number;
    version: number;
};
