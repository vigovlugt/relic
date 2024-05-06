import { ZodTypeAny, input } from "zod";
import { RelicClient } from "./relic-client";
import { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { MutationQueue } from "./database/mutation-queue";
import { SqliteDb } from "./database";
import { createSqliteWasmDb } from "../sqlite-wasm";
import { drizzle } from "./database/drizzle";
import { QueryClient, QueryOptions } from "@tanstack/query-core";
import { SQLiteSelectBase } from "drizzle-orm/sqlite-core";
import { RollbackManager as RollbackManager } from "./database/rollback";
import { Mutex } from "../mutex";
import { MetadataManager } from "./database/metadata";
import { RelicPullRequest, RelicPullResponse } from "../shared/pull";
import { RelicPushRequest } from "../shared/push";
import { applyPullData } from "./database/pull";

export type RelicPuller = (
    pull: RelicPullRequest
) => Promise<RelicPullResponse>;
export type RelicPusher = (push: RelicPushRequest) => Promise<void>;

export type RelicVanillaClientOptions = {
    pusher?: RelicPusher;
    puller?: RelicPuller;
    url: string;
};

export class RelicVanillaClient<TClient extends RelicClient> {
    private id: string;
    // Due to the async nature of JavaScript, we must use a mutex to ensure that only one transaction is running at a time
    private dbMutex: Mutex;

    private relicClient: TClient;
    private queryClient: QueryClient;
    private context: TClient["_"]["context"];

    private sqlite: SqliteDb;
    private db: SqliteRemoteDatabase;
    private mutationQueue: MutationQueue;
    private rollbackManager: RollbackManager;
    private metadata: MetadataManager;

    private url: string;
    private pusher: RelicPusher;
    private puller: RelicPuller;

    public mutate: {
        [K in keyof TClient["_"]["mutations"]]: TClient["_"]["mutations"][K]["_"]["input"] extends ZodTypeAny
            ? (
                  input: input<TClient["_"]["mutations"][K]["_"]["input"]>
              ) => Promise<void>
            : () => Promise<void>;
    };

    constructor(
        id: string,
        relicClient: TClient,
        context: TClient["_"]["context"],
        sqlite: SqliteDb,
        db: SqliteRemoteDatabase,
        mutationQueue: MutationQueue,
        rollbackManager: RollbackManager,
        metadata: MetadataManager,
        queryClient: QueryClient,
        { pusher, puller, url }: RelicVanillaClientOptions
    ) {
        this.id = id;
        this.dbMutex = new Mutex();
        this.relicClient = relicClient;
        this.context = context;
        this.sqlite = sqlite;
        this.db = db;
        this.mutationQueue = mutationQueue;
        this.rollbackManager = rollbackManager;
        this.metadata = metadata;
        this.queryClient = queryClient;
        this.url = url;
        this.pusher =
            pusher ??
            (async (push) => {
                const res = await fetch(this.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(push),
                });
                if (!res.ok) {
                    throw new Error(
                        "Failed to push mutations: " + res.statusText
                    );
                }
            });
        this.puller =
            puller ??
            (async (pull) => {
                // TODO: remove comment if not needed
                // return {
                //     version: 1,
                //     data: {
                //         todos: [{ id: "x", name: "Hello", done: false }],
                //     },
                //     lastProcessedMutationId: 1,
                // };
                const res = await fetch(this.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(pull),
                });
                if (!res.ok) {
                    throw new Error(
                        "Failed to push mutations: " + res.statusText
                    );
                }

                return await res.json();
            });

        // Create the mutate object, which allows consumers to call mutations type-safe, like client.mutate.addTodo("New todo")
        this.mutate = Object.fromEntries(
            Object.entries(this.relicClient._.mutations).map(
                ([key, mutation]) => {
                    return [
                        key,
                        async (
                            input: typeof mutation._.input extends ZodTypeAny
                                ? input<typeof mutation._.input>
                                : never
                        ) => {
                            await this.dbMutex.withLock(
                                async () =>
                                    // The mutationQueue must be atomically updated with the effects of the mutation if the mutation succeeds
                                    // Therefore, we run the mutation itself and the mutationQueue update in the same transaction
                                    await this.db.transaction(async (tx) => {
                                        // While not using the tx object, this is still ran in the transaction of tx
                                        await this.mutationQueue.add({
                                            name: key,
                                            input,
                                        });

                                        // Invoke the mutation
                                        await mutation._.handler({
                                            input,
                                            context: this.context,
                                            tx,
                                        });
                                    })
                            );

                            await this.invalidateQueries();
                        },
                    ];
                }
            )
        ) as typeof this.mutate;
    }

    public async query<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        TQuery extends SQLiteSelectBase<any, "async", any, any>
    >(query: TQuery) {
        return await this.dbMutex.withLock(async () => await query.execute());
    }

    public async invalidateQueries() {
        await this.queryClient.invalidateQueries({
            queryKey: ["_relic", this.id, "queries"],
        });
    }

    public queryOptions<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        TQuery extends SQLiteSelectBase<any, "async", any, any>
    >(query: TQuery) {
        const { sql, params } = query.toSQL();

        return {
            queryFn: async () => {
                return await this.dbMutex.withLock(async () => {
                    return await query.execute();
                });
            },
            queryKey: ["_relic", this.id, "queries", sql, params],
        } satisfies QueryOptions;
    }

    // TODO: mutationoptions

    public async push() {
        const mutations = await this.dbMutex.withLock(
            async () => await this.mutationQueue.getAll()
        );

        await this.pusher({
            clientId: this.id,
            mutations,
        });
    }

    public async pull() {
        // TODO: should lock pull, so two pulls do not mess up state

        const version = Number(
            await this.dbMutex.withLock(() => this.metadata.get("version"))
        );
        const pullData = await this.puller({
            clientId: this.id,
            version,
        });

        // Get server data
        await this.dbMutex.withLock(async () => {
            await this.db.transaction(async (tx) => {
                // Make sure version is still the same, otherwise delta for previous version should not be applied
                const currentVersion = Number(
                    await this.metadata.get("version")
                );
                if (currentVersion !== version) {
                    throw new Error(
                        `Could not apply pull: version mismatch, expected ${version} but got ${currentVersion}`
                    );
                }

                // Rollback data
                await this.rollbackManager.rollback();

                // Apply server data
                await applyPullData(
                    this.sqlite,
                    this.relicClient._.schema,
                    tx,
                    pullData
                );
                // The authorative server data should be the new beginning of the rollback log
                await this.rollbackManager.clear();

                // Set new version to be used for next pull
                await this.metadata.set("version", String(pullData.version));

                // delete processed mutations
                this.mutationQueue.deleteUpTo(pullData.lastProcessedMutationId);

                // reapply pending mutations
                const pendingMutations = await this.mutationQueue.getAll();
                for (const { name, input } of pendingMutations) {
                    const mut = this.relicClient._.mutations[name];
                    if (!mut) {
                        throw new Error(`Mutation ${name} not found`);
                    }

                    try {
                        // Try mutations in nested transactions, so every mutation is atomic
                        // Failed mutations will not fail the entire pull
                        await tx.transaction(async (tx) => {
                            await mut._.handler({
                                input,
                                context: this.context,
                                tx,
                            });
                        });
                    } catch (e) {
                        console.error(
                            "Error when applying mutation, it has not been re-applied:",
                            name,
                            "with input:",
                            input,
                            "error:",
                            e
                        );
                    }
                }
            });
        });

        await this.invalidateQueries();
    }

    // TODO: remove
    public async debug() {
        console.log({
            mutations: await this.mutationQueue.getAll(),
            rollback: await this.rollbackManager.getAll(),
            metadata: await this.metadata.getAll(),
        });
    }
}

// TODO: refactor
export async function createRelicVanillaClient<TClient extends RelicClient>({
    relicClient,
    context,
    db,
    sqlite,
    queryClient,
    ...options
}: {
    relicClient: TClient;
    // TODO: what if no context
    context: TClient["_"]["context"];
    db?: SqliteRemoteDatabase;
    sqlite?: SqliteDb;
    queryClient: QueryClient;
} & RelicVanillaClientOptions) {
    sqlite = sqlite ?? (await createSqliteWasmDb());
    db = db ?? drizzle(sqlite);

    const mutationQueue = new MutationQueue(sqlite, "_relic_mutation_queue");
    const rollbackManager = new RollbackManager(sqlite, "_relic_rollback_log");
    const metadata = new MetadataManager(sqlite, "_relic_metadata");

    // Initialize metadata table
    await metadata.setup();
    const clientId = await metadata.get("clientId");
    // Initialize mutation queue table
    await mutationQueue.setup();
    // Setup rollback manager table and triggers
    await rollbackManager.setup();

    return new RelicVanillaClient(
        clientId,
        relicClient,
        context,
        sqlite,
        db,
        mutationQueue,
        rollbackManager,
        metadata,
        queryClient,
        options
    );
}
