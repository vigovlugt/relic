import { RelicSchema, RelicContext } from "./relic-definition-builder";
import { RelicMutation } from "../relic-mutation";

export class RelicDefinition<
    TContext extends RelicContext = RelicContext,
    TSchema extends RelicSchema = RelicSchema,
    TMutations extends Record<string, RelicMutation<TContext>> = Record<
        string,
        RelicMutation<TContext>
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
