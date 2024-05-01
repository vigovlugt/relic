import { RelicMutation, RelicMutationWithHandler } from "../relic-mutation";
import { RelicDefinition } from "../shared/relic-definition";
import { RelicContext } from "../shared/relic-definition-builder";
import { RelicClient } from "./relic-client";

type DefinitionMutationsToClientMutations<
    TMutations extends Record<string, RelicMutation>,
    TClientContext extends RelicContext
> = {
    [K in keyof TMutations]: RelicMutation<
        TMutations[K]["_"]["context"] & TClientContext,
        TMutations[K]["_"]["input"],
        TMutations[K]["_"]["handler"]
    >;
};

export class RelicClientBuilder<
    TDef extends RelicDefinition = RelicDefinition,
    TContext extends RelicContext = RelicContext
> {
    public _: {
        definition: TDef;
        context: TContext;
    };

    public mutation: DefinitionMutationsToClientMutations<
        TDef["_"]["mutations"],
        TContext
    >;

    constructor(definition: TDef) {
        this._ = {
            definition,
            context: undefined as unknown as TContext,
        };

        this.mutation = definition._
            .mutations as DefinitionMutationsToClientMutations<
            TDef["_"]["mutations"],
            TContext
        >;
    }

    context<TNewContext extends RelicContext>() {
        return new RelicClientBuilder<TDef, TNewContext>(this._.definition);
    }

    mutations<
        TCtx extends TDef["_"]["context"] & TContext,
        TMutations extends {
            [K in keyof TDef["_"]["mutations"]]: RelicMutationWithHandler<
                TCtx,
                TDef["_"]["mutations"][K]["_"]["input"],
                NonNullable<TDef["_"]["mutations"][K]["_"]["handler"]>
            >;
        }
    >(mutations: TMutations) {
        return new RelicClient<TCtx, TDef["_"]["schema"], TMutations>(
            this._.definition._.schema,
            mutations
        );
    }
}

export function initRelicClient(definition: RelicDefinition) {
    return new RelicClientBuilder(definition);
}
