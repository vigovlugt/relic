import { RelicMutation, RelicMutationInput } from "../shared/relic-mutation";
import { RelicContext, RelicSchema } from "../shared/relic-definition-builder";
import { RelicPushRequest } from "../shared/push";
import { RelicServerDatabase } from "./relic-server-database";
import { RelicPullRequest, RelicPullResponse } from "../shared/pull";
import { RelicPull } from "../shared/relic-pull";

export type RelicServerPullOptions<TTx> = {
    req: RelicPullRequest;
    ctx: RelicContext;
    database: RelicServerDatabase<TTx>;
};

export type RelicServerPushOptions<TTx> = {
    req: RelicPushRequest;
    ctx: RelicContext;
    database: RelicServerDatabase<TTx>;
};

export class RelicServer<
    TContext extends RelicContext = RelicContext,
    TSchema extends RelicSchema = RelicSchema,
    TMutations extends Record<string, RelicMutation<TContext>> = Record<
        string,
        RelicMutation<TContext, RelicMutationInput>
    >,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TTx = any
> {
    public _: {
        schema: TSchema;
        context: TContext;
        mutations: TMutations;
        tx: TTx;
        // TODO: make more specific
        puller: RelicPull;
    };

    constructor(schema: TSchema, mutations: TMutations, puller: RelicPull) {
        this._ = {
            schema,
            context: undefined as unknown as TContext,
            mutations,
            tx: undefined as unknown as TTx,
            puller,
        };
    }

    async pull({
        req,
        database,
        ctx,
    }: RelicServerPullOptions<TTx>): Promise<RelicPullResponse> {
        const { clientId, version } = req;

        return await database.transaction(async (tx) => {
            let client = await database.getClient(tx, clientId);
            if (!client) {
                await database.createClient(tx, clientId);
                client = {
                    id: clientId,
                    mutationId: 0,
                };
            }

            const data = await this._.puller._.handler({
                tx,
                ctx,
            });

            return {
                data,
                lastProcessedMutationId: client.mutationId,
                version,
            };
        });
    }

    async push({
        req: request,
        ctx: context,
        database,
    }: RelicServerPushOptions<TTx>) {
        for (const { id, name, input } of request.mutations) {
            await database.transaction(async (tx) => {
                const mutation = this._.mutations[name];
                if (!mutation) {
                    throw new Error(`Mutation ${name} not found`);
                }

                let client = await database.getClient(tx, request.clientId);
                // TODO: verify client is owned by user
                if (!client) {
                    await database.createClient(tx, request.clientId);
                    client = {
                        id: request.clientId,
                        mutationId: 0,
                    };
                }

                const nextMutation = client.mutationId + 1;
                if (id < nextMutation) {
                    console.log(
                        `Mutation ${id} has already been processed, skipping`
                    );
                    return;
                }

                if (id > nextMutation) {
                    throw new Error(
                        `Mutation ${id} is in the future, cannot process`
                    );
                }

                console.log(`Processing mutation ${id}`);

                // TODO: handle errors, either nested transaction, or redo transactionw without executing mutation
                // Execute mutation
                await mutation._.handler({
                    tx,
                    input,
                    ctx: context,
                });

                // Update client mutationId
                await database.updateClient(tx, request.clientId, nextMutation);
            });
        }

        // TODO: poke
    }
}
