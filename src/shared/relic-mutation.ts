import { RelicContext } from "./relic-definition-builder";
import { ZodTypeAny, output } from "zod";

export type RelicMutationHandlerOptions<
    TContext extends RelicContext,
    TInput extends RelicMutationInput,
    TTx = unknown
> = {
    input: TInput extends ZodTypeAny ? output<TInput> : never;
    ctx: TContext;
    tx: TTx;
};

export type RelicMutationInput = ZodTypeAny | undefined;

export type RelicMutationHandler<
    TContext extends RelicContext = RelicContext,
    TInput extends RelicMutationInput = RelicMutationInput,
    TTx = unknown
> = (
    opts: RelicMutationHandlerOptions<TContext, TInput, TTx>
) => Promise<void> | void;

export class RelicMutationBuilder<
    TContext extends RelicContext = RelicContext,
    TInput extends RelicMutationInput = RelicMutationInput,
    TTx = unknown
> {
    public _: {
        context: TContext;
        input: TInput;
    };

    constructor(input: TInput) {
        this._ = {
            context: undefined as unknown as TContext,
            input,
        };
    }

    input<TNewInput extends ZodTypeAny>(input: TNewInput) {
        return new RelicMutationBuilder<TContext, TNewInput>(input);
    }

    mutate<THandler extends RelicMutationHandler<TContext, TInput, TTx>>(
        handler: THandler
    ) {
        return new RelicMutation<TContext, TInput, TTx>(
            this._.context,
            this._.input,
            handler
        );
    }
}

export class RelicMutation<
    TContext extends RelicContext = RelicContext,
    TInput extends RelicMutationInput = RelicMutationInput,
    TTx = unknown
> {
    public _: {
        context: TContext;
        input: TInput;
        // TODO: Should be more specific
        handler: RelicMutationHandler;
    };

    constructor(
        context: TContext,
        input: TInput,
        handler: RelicMutationHandler<TContext, TInput, TTx>
    ) {
        this._ = {
            context,
            input,
            handler: handler as RelicMutationHandler,
        };
    }

    mutate<THandler extends RelicMutationHandler<TContext, TInput>>(
        handler: THandler
    ) {
        return new RelicMutation<TContext, TInput>(
            this._.context,
            this._.input,
            handler
        );
    }
}
