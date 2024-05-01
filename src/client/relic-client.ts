import { RelicMutationWithHandler } from "../relic-mutation";
import { RelicContext, RelicSchema } from "../shared/relic-definition-builder";

export class RelicClient<
    TContext extends RelicContext,
    TSchema extends RelicSchema,
    TMutations extends Record<string, RelicMutationWithHandler<TContext>>
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
