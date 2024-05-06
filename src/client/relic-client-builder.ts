import { SQLiteTransaction } from "drizzle-orm/sqlite-core";
import { RelicMutation, RelicMutationBuilder } from "../shared/relic-mutation";
import { RelicDefinition } from "../shared/relic-definition";
import { RelicContext } from "../shared/relic-definition-builder";
import { RelicClient } from "./relic-client";
import { SqliteRemoteResult } from "drizzle-orm/sqlite-proxy";
import { ExtractTablesWithRelations } from "drizzle-orm";

export type ClientTx = SQLiteTransaction<
    "async",
    SqliteRemoteResult<unknown>,
    Record<string, never>,
    ExtractTablesWithRelations<Record<string, never>>
>;
export class RelicClientBuilder<
    TDef extends RelicDefinition = RelicDefinition,
    TContext extends RelicContext = RelicContext
> {
    public _: {
        definition: TDef;
        context: TContext;
    };

    public mutation: {
        [K in keyof TDef["_"]["mutations"]]: TDef["_"]["mutations"] extends RelicMutation
            ? RelicMutation<
                  TContext & TDef["_"]["context"],
                  TDef["_"]["mutations"][K]["_"]["input"],
                  ClientTx
              >
            : RelicMutationBuilder<
                  TContext & TDef["_"]["context"],
                  TDef["_"]["mutations"][K]["_"]["input"],
                  ClientTx
              >;
    };

    constructor(definition: TDef) {
        this._ = {
            definition,
            context: undefined as unknown as TContext,
        };

        this.mutation = definition._.mutations as typeof this.mutation;
    }

    context<TNewContext extends RelicContext>() {
        return new RelicClientBuilder<TDef, TNewContext>(this._.definition);
    }

    mutations<
        TCtx extends TDef["_"]["context"] & TContext,
        TMutations extends {
            [K in keyof TDef["_"]["mutations"]]: RelicMutation<
                TCtx,
                TDef["_"]["mutations"][K]["_"]["input"]
            >;
        }
    >(mutations: TMutations) {
        return new RelicClient<TCtx, TDef["_"]["schema"], TMutations>(
            this._.definition._.schema,
            mutations
        );
    }
}

export function initRelicClient<TDef extends RelicDefinition>(
    definition: TDef
) {
    return new RelicClientBuilder(definition);
}
