import { RelicContext } from "@relic/core";

export type RelicPokeHandlerOptions<TContext extends RelicContext> = {
    ctx: TContext;
};

export type RelicPokeHandler<TContext extends RelicContext = RelicContext> = (
    opts: RelicPokeHandlerOptions<TContext>
) => Promise<void> | void;

export class RelicPokeBuilder<TContext extends RelicContext = RelicContext> {
    public _: {
        context: TContext;
    };

    constructor() {
        this._ = {
            context: undefined as unknown as TContext,
        };
    }

    poke<THandler extends RelicPokeHandler<TContext>>(handler: THandler) {
        return new RelicPoke<TContext>(this._.context, handler);
    }
}

export class RelicPoke<TContext extends RelicContext = RelicContext> {
    public _: {
        context: TContext;
        // TODO: Should be more specific
        handler: RelicPokeHandler;
    };

    constructor(context: TContext, handler: RelicPokeHandler<TContext>) {
        this._ = {
            context,
            handler: handler as RelicPokeHandler,
        };
    }
}
