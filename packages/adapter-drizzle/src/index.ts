export * from "./sqlite-adapter";
export * from "./sqlite-adapter-row-version";
export * from "./pg-adapter-row-version";
export * from "./pg-adapter";

// TODO: extract transaction from schema, not db object
export type ExtractTransaction<
    TDB extends {
        transaction: (fn: (tx: any) => any) => any;
    },
> = Parameters<Parameters<TDB["transaction"]>[0]>[0];
