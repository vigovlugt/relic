import {
    RelicMutation,
    RelicMutationInput,
    RelicContext,
    RelicSchema,
} from "@relic/core";
import { ClientTx } from "./relic-client-builder";

export class RelicClient<
    TContext extends RelicContext = RelicContext,
    TSchema extends RelicSchema = RelicSchema,
    TMutations extends Record<string, RelicMutation<TContext>> = Record<
        string,
        RelicMutation<TContext, RelicMutationInput, ClientTx>
    >
> {
    public _: {
        schema: TSchema;
        context: TContext;
        mutations: TMutations;
    };

    constructor(schema: TSchema, mutations: TMutations) {
        this._ = {
            schema,
            context: undefined as unknown as TContext,
            mutations,
        };
    }
}
