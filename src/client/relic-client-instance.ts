import { ZodTypeAny, input } from "zod";
import { RelicClient } from "./relic-client";
import { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { MutationQueue } from "./database/mutation-queue";
import { SqliteDb } from "./database";
import { createSqliteWasmDb } from "../sqlite-wasm";
import { drizzle } from "./database/drizzle";
import { QueryClient, QueryOptions } from "@tanstack/query-core";
import { SQLiteSelectBase } from "drizzle-orm/sqlite-core";
import { RollbackManager } from "./database/rollback";
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

export class RelicClientInstance<TClient extends RelicClient> {
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

        this.onOnline = this.onOnline.bind(this);

        this.pusher =
            pusher ??
            (async (push) => {
                const url =
                    this.url + (this.url.endsWith("/") ? "" : "/") + "push";
                const res = await fetch(url, {
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
                const url =
                    this.url + (this.url.endsWith("/") ? "" : "/") + "pull";
                const res = await fetch(url, {
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
                                            ctx: this.context,
                                            tx,
                                        });
                                    })
                            );

                            // Do push and invalidate queries asynchronously
                            this.push();
                            this.invalidateQueries();
                            this.invalidatePendingMutations();
                        },
                    ];
                }
            )
        ) as typeof this.mutate;
    }

    public async fetchQuery<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        TQuery extends SQLiteSelectBase<any, "async", any, any>
    >(query: TQuery) {
        return await this.dbMutex.withLock(async () => await query.execute());
    }

    public query<
        TQuery extends Pick<
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            SQLiteSelectBase<any, "async", any, any>,
            "execute" | "toSQL"
        >
    >(query: TQuery) {
        const { sql, params } = query.toSQL();

        return {
            queryFn: async () => {
                const result = await this.dbMutex.withLock(async () => {
                    return await query.execute();
                });

                return result;
            },
            queryKey: ["_relic", this.id, "queries", sql, params],
            networkMode: "offlineFirst",
        } satisfies QueryOptions;
    }

    private async invalidateQueries() {
        await this.queryClient.invalidateQueries({
            queryKey: ["_relic", this.id, "queries"],
        });
    }

    public fetchPendingMutations() {
        return this.dbMutex.withLock(async () => this.mutationQueue.getAll());
    }

    public pendingMutations() {
        return {
            queryFn: async () =>
                await this.dbMutex.withLock(
                    async () => await this.mutationQueue.getAll()
                ),
            queryKey: ["_relic", this.id, "pendingMutations"],
            networkMode: "offlineFirst",
        } satisfies QueryOptions;
    }

    private async invalidatePendingMutations() {
        await this.queryClient.invalidateQueries({
            queryKey: ["_relic", this.id, "pendingMutations"],
        });
    }

    // TODO: mutationoptions

    public async push() {
        if (!navigator.onLine) {
            return;
        }

        const mutations = await this.dbMutex.withLock(
            async () => await this.mutationQueue.getAll()
        );
        if (mutations.length === 0) {
            return;
        }

        await this.pusher({
            clientId: this.id,
            mutations,
        });

        this.pull();
        this.invalidatePendingMutations();
    }

    public async pull() {
        if (!navigator.onLine) {
            return;
        }
        // TODO: should lock pull, so two pulls do not mess up state

        const version = await this.dbMutex.withLock(() =>
            this.metadata.get("version")
        );
        const pullData = await this.puller({
            clientId: this.id,
            version,
        });

        // Get server data
        await this.dbMutex.withLock(async () => {
            await this.db.transaction(async (tx) => {
                // Make sure version is still the same, otherwise delta for previous version should not be applied
                const currentVersion = await this.metadata.get("version");

                if (currentVersion !== version) {
                    throw new Error(
                        `Could not apply pull: version mismatch, expected ${version} but got ${currentVersion}`
                    );
                }

                // Rollback data
                await this.rollbackManager.rollback();

                // Apply server data, still within the same transaction
                await applyPullData(
                    this.sqlite,
                    this.relicClient._.schema,
                    pullData
                );
                // The authorative server data should be the new beginning of the rollback log
                await this.rollbackManager.clear();

                // Set new version to be used for next pull
                await this.metadata.set(
                    "version",
                    String(pullData.data.version)
                );

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
                                ctx: this.context,
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

        this.invalidatePendingMutations();
        this.invalidateQueries();
    }

    private onOnline() {
        this.pull();
        this.push();
    }

    setup() {
        window.addEventListener("online", this.onOnline);
    }

    destroy() {
        window.removeEventListener("online", this.onOnline);
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
export async function createRelicClient<TClient extends RelicClient>({
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

    const newClient = new RelicClientInstance(
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

    // Do a pull and push when the client is created, so the client is up-to-date
    // Not important to await this, as the client will be up-to-date eventually
    newClient.pull();
    newClient.push();
    newClient.setup();

    // TODO: remove
    // setInterval(() => {
    //     newClient.pull();
    // }, 1000);

    return newClient;
}
