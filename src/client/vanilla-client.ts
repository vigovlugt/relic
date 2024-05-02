import { ZodTypeAny, input } from "zod";
import { RelicClient } from "./relic-client";
import { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import { MutationQueue } from "./mutation-queue";
import { SqliteDb } from "./database";
import { createSqliteWasmDb } from "../sqlite-wasm";
import { drizzle } from "./database/drizzle";
import { QueryClient, QueryOptions } from "@tanstack/query-core";
import { SQLiteSelectBase } from "drizzle-orm/sqlite-core";
import { RollbackManager as RollbackLog } from "./database/rollback";

export class RelicVanillaClient<TClient extends RelicClient> {
    private relicClient: TClient;
    private context: TClient["_"]["context"];
    private db: SqliteRemoteDatabase;
    private mutationQueue: MutationQueue;
    private rollbackManager: RollbackLog;
    private queryClient: QueryClient;
    private id: string;

    public mutate: {
        [K in keyof TClient["_"]["mutations"]]: TClient["_"]["mutations"][K]["_"]["input"] extends ZodTypeAny
            ? (
                  input: input<TClient["_"]["mutations"][K]["_"]["input"]>
              ) => Promise<void>
            : () => Promise<void>;
    };

    constructor(
        relicClient: TClient,
        context: TClient["_"]["context"],
        db: SqliteRemoteDatabase,
        mutationQueue: MutationQueue,
        rollbackManager: RollbackLog,
        queryClient: QueryClient
    ) {
        this.relicClient = relicClient;
        this.context = context;
        this.db = db;
        this.mutationQueue = mutationQueue;
        this.rollbackManager = rollbackManager;
        this.queryClient = queryClient;
        this.id = crypto.randomUUID();

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
                            // TODO: LOCK
                            // The mutationQueue must be atomically updated if the mutation succeeds
                            await this.db.transaction(async (tx) => {
                                // While not using the tx object, this is still ran in the transaction of tx
                                await this.mutationQueue.add({
                                    type: key,
                                    input,
                                });

                                // Invoke the mutation
                                await mutation._.handler({
                                    input,
                                    context: this.context,
                                    tx,
                                });
                            });
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
        // TODO: LOCK
        return await query;
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
            queryFn: async () => this.query(query),
            queryKey: ["_relic", this.id, "queries", sql, params],
        } satisfies QueryOptions;
    }

    // TODO: pulloptions

    public async pull() {
        // Get server data

        // TODO: LOCK DB
        await this.db.transaction(async (tx) => {
            // Rollback data
            await this.rollbackManager.rollback();

            // Apply server data

            // delete processed mutations

            const pendingMutations = await this.mutationQueue.getAll();

            // reapply pending mutations
            for (const { type, input } of pendingMutations) {
                const mut = this.relicClient._.mutations[type];
                if (!mut) {
                    throw new Error(`Mutation ${type} not found`);
                }

                // TODO: What if the mutation fails when reapplying?
                await mut._.handler({
                    input,
                    context: this.context,
                    tx,
                });
            }
        });
    }

    public async debug() {
        console.log({
            mutations: await this.mutationQueue.getAll(),
            rollback: await this.rollbackManager.getAll(),
        });
    }
}

export async function createRelicVanillaClient<TClient extends RelicClient>({
    relicClient,
    context,
    db,
    sqlite,
    queryClient,
}: {
    relicClient: TClient;
    context: TClient["_"]["context"];
    db?: SqliteRemoteDatabase;
    sqlite?: SqliteDb;
    queryClient: QueryClient;
}) {
    sqlite = sqlite ?? (await createSqliteWasmDb());
    db = db ?? drizzle(sqlite);

    const mutationQueue = new MutationQueue(sqlite, "_relic_mutation_queue");
    const rollbackManager = new RollbackLog(sqlite, "_relic_rollback_log");

    // Initialize mutation queue table
    await mutationQueue.setup();
    // Setup rollback manager table and triggers
    await rollbackManager.activate();

    return new RelicVanillaClient(
        relicClient,
        context,
        db,
        mutationQueue,
        rollbackManager,
        queryClient
    );
}
