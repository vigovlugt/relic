import { RelicMutation, RelicMutationBuilder } from "../shared/relic-mutation";
import { RelicDefinition } from "../shared/relic-definition";
import { RelicContext } from "../shared/relic-definition-builder";
import { RelicServer } from "./relic-server";
import { RelicPull, RelicPullBuilder } from "./relic-pull";

export class RelicServerBuilder<
    TDef extends RelicDefinition = RelicDefinition,
    TContext extends RelicContext = RelicContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TTx = any
> {
    public _: {
        definition: TDef;
        context: TContext;
        tx: TTx;
        puller: RelicPull<TDef["_"]["schema"], TContext, TTx> | undefined;
    };

    public mutation: {
        [K in keyof TDef["_"]["mutations"]]: TDef["_"]["mutations"] extends RelicMutation
            ? RelicMutation<
                  TContext & TDef["_"]["context"],
                  TDef["_"]["mutations"][K]["_"]["input"],
                  TTx
              >
            : RelicMutationBuilder<
                  TContext & TDef["_"]["context"],
                  TDef["_"]["mutations"][K]["_"]["input"],
                  TTx
              >;
    };

    get puller() {
        return new RelicPullBuilder<TDef["_"]["schema"], TContext, TTx>();
    }

    constructor(
        definition: TDef,
        puller: RelicPull<TDef["_"]["schema"], TContext, TTx> | undefined
    ) {
        this._ = {
            definition,
            context: undefined as unknown as TContext,
            tx: undefined as unknown as TTx,
            puller,
        };

        this.mutation = definition._.mutations as typeof this.mutation;
    }

    context<TNewContext extends RelicContext>() {
        return new RelicServerBuilder<TDef, TNewContext, TTx>(
            this._.definition,
            undefined
        );
    }

    transaction<TNewTx>() {
        return new RelicServerBuilder<TDef, TContext, TNewTx>(
            this._.definition,
            undefined
        );
    }

    pull(pull: RelicPull<TDef["_"]["schema"], TContext, TTx>) {
        return new RelicServerBuilder<TDef, TContext, TTx>(
            this._.definition,
            pull
        );
    }

    mutations<
        TCtx extends TDef["_"]["context"] & TContext,
        TMutations extends {
            [K in keyof TDef["_"]["mutations"]]: RelicMutation<
                TCtx,
                TDef["_"]["mutations"][K]["_"]["input"],
                TTx
            >;
        }
    >(mutations: TMutations) {
        // TODO: Make type safe
        if (!this._.puller) {
            throw new Error("Puller not set");
        }

        return new RelicServer<TCtx, TDef["_"]["schema"], TMutations, TTx>(
            this._.definition._.schema,
            mutations,
            this._.puller
        );
    }
}

export function initRelicServer<TDef extends RelicDefinition>(
    definition: TDef
) {
    return new RelicServerBuilder(definition, undefined);
}
