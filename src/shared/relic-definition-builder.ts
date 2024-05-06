import { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import { RelicMutation, RelicMutationBuilder } from "./relic-mutation";
import { RelicDefinition } from "./relic-definition";

// TODO: any -> TableConfig
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RelicSchema = Record<string, SQLiteTableWithColumns<any>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RelicContext = Record<string, any>;

export class RelicDefinitionBuilder<
    TSchema extends RelicSchema = RelicSchema,
    TContext extends RelicContext = RelicContext
> {
    public _: {
        schema: TSchema;
        context: TContext;
    };

    constructor(schema: TSchema) {
        this._ = {
            schema,
            context: undefined as unknown as TContext,
        };
    }

    schema<TNewSchema extends RelicSchema>(schema: TNewSchema) {
        return new RelicDefinitionBuilder<TNewSchema, TContext>(schema);
    }

    context<TNewContext extends RelicContext>() {
        return new RelicDefinitionBuilder<TSchema, TNewContext>(this._.schema);
    }

    get mutation() {
        return new RelicMutationBuilder<TContext, undefined>(undefined);
    }

    mutations<
        TMutations extends Record<
            string,
            RelicMutationBuilder<TContext> | RelicMutation<TContext>
        >
    >(mutations: TMutations) {
        return new RelicDefinition<TContext, TSchema, TMutations>(
            this._.schema,
            mutations
        );
    }
}

export function initRelicDefinition() {
    return new RelicDefinitionBuilder({});
}
