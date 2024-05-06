import { InferSelectModel } from "drizzle-orm";
import { RelicContext, RelicSchema } from "./relic-definition-builder";

export type RelicPullHandlerOptions<
    TContext extends RelicContext,
    TTx = unknown
> = {
    ctx: TContext;
    tx: TTx;
};

export type RelicPullHandler<
    TSchema extends RelicSchema = RelicSchema,
    TContext extends RelicContext = RelicContext,
    TTx = unknown
> = (
    opts: RelicPullHandlerOptions<TContext, TTx>
) => Promise<RelicPullHandlerResult<TSchema>> | RelicPullHandlerResult<TSchema>;

type RelicPullHandlerResult<TSchema extends RelicSchema> = {
    clear: boolean;
    entities: {
        [K in keyof TSchema]: {
            put: InferSelectModel<TSchema[K]>[];
            delete: string[];
        };
    };
};

export class RelicPullBuilder<
    TSchema extends RelicSchema = RelicSchema,
    TContext extends RelicContext = RelicContext,
    TTx = unknown
> {
    public _: {
        context: TContext;
    };

    constructor() {
        this._ = {
            context: undefined as unknown as TContext,
        };
    }

    pull<THandler extends RelicPullHandler<TSchema, TContext, TTx>>(
        handler: THandler
    ) {
        return new RelicPull<TSchema, TContext, TTx>(this._.context, handler);
    }
}

export class RelicPull<
    TSchema extends RelicSchema = RelicSchema,
    TContext extends RelicContext = RelicContext,
    TTx = unknown
> {
    public _: {
        context: TContext;
        // TODO: Should be more specific
        handler: RelicPullHandler;
    };

    constructor(
        context: TContext,
        handler: RelicPullHandler<TSchema, TContext, TTx>
    ) {
        this._ = {
            context,
            handler: handler as RelicPullHandler,
        };
    }
}
