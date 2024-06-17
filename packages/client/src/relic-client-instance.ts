import { ZodTypeAny, input } from "zod";
import { RelicClient } from "./relic-client";
import { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { MutationQueue } from "./database/mutation-queue";
import { SqliteDb } from "./database";
import { QueryClient } from "@tanstack/query-core";
import { RollbackManager } from "./database/rollback";
import { Mutex } from "./mutex";
import { MetadataManager } from "./database/metadata";
import {
    RelicPullRequest,
    RelicPullResponse,
    RelicPushRequest,
} from "@relic/core";
import { applyPullData } from "./database/pull";
import { PokeAdapter as RelicPokeAdapter } from "./poke-adapters/poke-adapter";

export type RelicPuller = (
    pull: RelicPullRequest
) => Promise<RelicPullResponse>;
export type RelicPusher = (push: RelicPushRequest) => Promise<void>;

export type RelicVanillaClientOptions = {
    pusher?: RelicPusher;
    puller?: RelicPuller;
    url: string;
    poker?: RelicPokeAdapter;
};

export class RelicClientInstance<TClient extends RelicClient> {
    private id: string;
    // Due to the async nature of JavaScript, we must use a mutex to ensure that only one transaction is running at a time
    private dbMutex: Mutex;

    private relicClient: TClient;
    private queryClient: QueryClient;
    private context: TClient["_"]["context"];

    private sqlite: SqliteDb;
    private db: SqliteRemoteDatabase<Record<string, unknown>>;
    private mutationQueue: MutationQueue;
    private rollbackManager: RollbackManager;
    private metadata: MetadataManager;

    private url: URL;
    private pusher: RelicPusher;
    private puller: RelicPuller;
    private pokeAdapter: RelicPokeAdapter | undefined;
    private closePokeAdapter?: () => void;
    public currentPull?: Promise<void>;

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
        db: SqliteRemoteDatabase<Record<string, unknown>>,
        mutationQueue: MutationQueue,
        rollbackManager: RollbackManager,
        metadata: MetadataManager,
        queryClient: QueryClient,
        { pusher, puller, url, poker: pokeAdapter }: RelicVanillaClientOptions
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
        this.url = new URL(url);
        this.pokeAdapter = pokeAdapter;

        this.onOnline = this.onOnline.bind(this);

        this.pusher =
            pusher ??
            (async (push) => {
                const url = new URL(this.url);
                url.pathname += url.pathname.endsWith("/") ? "" : "/" + "push";

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
                const url = new URL(this.url);
                url.pathname += url.pathname.endsWith("/") ? "" : "/" + "pull";

                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(pull),
                });
                if (!res.ok) {
                    throw new Error(
                        "Failed to pull mutations: " + res.statusText
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
        TQuery extends {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            execute: () => Promise<any>;
        },
    >(query: TQuery): Promise<Awaited<ReturnType<TQuery["execute"]>>> {
        return await this.dbMutex.withLock(async () => await query.execute());
    }

    public query<
        TQuery extends {
            toSQL: () => {
                sql: string;
                params: unknown[];
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            execute: () => Promise<any>;
        },
    >(query: TQuery) {
        const { sql, params } = query.toSQL();

        return {
            queryFn: () => this.fetchQuery(query),
            queryKey: ["_relic", this.id, "queries", sql, params],
            networkMode: "always",
            // Will never get stale, as stale data is invalidated
            staleTime: Infinity,
        } as const;
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
            networkMode: "always",
            // Will never get stale, as stale data is invalidated
            staleTime: Infinity,
        } as const;
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

        this.invalidatePendingMutations();
    }

    public async pull() {
        while (this.currentPull) {
            await this.currentPull;
        }
        const { promise, resolve, reject } = Promise.withResolvers<void>();
        this.currentPull = promise;
        if (!navigator.onLine) {
            return;
        }
        // TODO: should lock pull, so two pulls do not mess up state

        try {
            const version = await this.dbMutex.withLock(() =>
                this.metadata.get("version")
            );
            const pullData = await this.puller({
                clientId: this.id,
                version: version ?? null,
            });

            const changes = Object.values(pullData.data.entities).reduce(
                (n, e) => n + e.set.length + e.delete.length,
                0
            );

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

                    // If there are too many changes, deactivate triggers to avoid trigger overhead
                    if (changes > 100) {
                        await this.rollbackManager.deactivate();
                        // Apply server data, still within the same transaction
                        await applyPullData(
                            this.sqlite,
                            this.relicClient._.schema,
                            pullData
                        );
                        await this.rollbackManager.activate();
                    } else {
                        // Apply server data, still within the same transaction
                        await applyPullData(
                            this.sqlite,
                            this.relicClient._.schema,
                            pullData
                        );
                        // The authorative server data should be the new beginning of the rollback log
                        await this.rollbackManager.clear();
                    }

                    // Set new version to be used for next pull
                    await this.metadata.set(
                        "version",
                        String(pullData.data.version)
                    );

                    // delete processed mutations
                    this.mutationQueue.deleteUpTo(
                        pullData.lastProcessedMutationId
                    );

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

            await Promise.all([
                this.invalidatePendingMutations(),
                this.invalidateQueries(),
            ]);
        } catch (e) {
            reject(e);
        } finally {
            resolve();
            this.currentPull = undefined;
        }
    }

    private onOnline() {
        this.pull();
        this.push();
    }

    setup() {
        window.addEventListener("online", this.onOnline);
        this.closePokeAdapter = this.pokeAdapter?.(() => this.pull());
    }

    destroy() {
        window.removeEventListener("online", this.onOnline);
        this.closePokeAdapter?.();
    }
}

// TODO: refactor
export async function createRelicClient<TClient extends RelicClient>({
    relicClient,
    db,
    sqlite,
    queryClient,
    ...options
}: {
    relicClient: TClient;
    db: SqliteRemoteDatabase<Record<string, unknown>>;
    sqlite: SqliteDb;
    queryClient: QueryClient;
} & RelicVanillaClientOptions &
    // Only require context if the client has a context
    (TClient["_"]["context"] extends Record<string, never>
        ? {}
        : { context: TClient["_"]["context"] })) {
    const mutationQueue = new MutationQueue(sqlite, "_relic_mutation_queue");
    const rollbackManager = new RollbackManager(sqlite, "_relic_rollback_log");
    const metadata = new MetadataManager(sqlite, "_relic_metadata");

    // Initialize metadata table
    await Promise.all([
        metadata.setup(),
        // Initialize mutation queue table
        mutationQueue.setup(),
        // Setup rollback manager table and triggers
        rollbackManager.activate(),
    ]);
    const clientId = await metadata.get("clientId");

    const newClient = new RelicClientInstance(
        clientId,
        relicClient,
        ("context" in options
            ? options.context
            : undefined) as TClient["_"]["context"],
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
    newClient.setup();
    newClient.pull();
    newClient.push();

    return newClient;
}
