import { RelicContext } from "./shared/relic-definition-builder";
import { ZodTypeAny } from "zod";

export type RelicMutationHandlerOptions<
    TContext extends RelicContext,
    TInput extends RelicMutationInput
> = {
    input: TInput;
    context: TContext;
};

export type RelicMutationInput = ZodTypeAny | undefined;

export type RelicMutationHandler<
    TContext extends RelicContext,
    TInput extends RelicMutationInput
> = (opts: RelicMutationHandlerOptions<TContext, TInput>) => void;

export class RelicMutation<
    TContext extends RelicContext = RelicContext,
    TInput extends RelicMutationInput = RelicMutationInput,
    THandler extends undefined | RelicMutationHandler<TContext, TInput> =
        | undefined
        | RelicMutationHandler<TContext, TInput>
> {
    public _: {
        context: TContext;
        input: TInput;
        handler: THandler;
    };

    constructor(input: TInput, handler: THandler) {
        this._ = {
            context: undefined as unknown as TContext,
            input,
            handler,
        };
    }

    input<TNewInput extends ZodTypeAny>(input: TNewInput) {
        if (this._.handler) {
            throw new Error("Cannot change input after handler has been set");
        }

        return new RelicMutation<TContext, TNewInput, undefined>(
            input,
            this._.handler
        );
    }

    mutate<TNewHandler extends RelicMutationHandler<TContext, TInput>>(
        handler: TNewHandler
    ) {
        return new RelicMutation<TContext, TInput, TNewHandler>(
            this._.input,
            handler
        );
    }
}

export type RelicMutationWithHandler<
    TContext extends RelicContext = RelicContext,
    TInput extends RelicMutationInput = RelicMutationInput,
    THandler extends RelicMutationHandler<
        TContext,
        TInput
    > = RelicMutationHandler<TContext, TInput>
> = RelicMutation<TContext, TInput, THandler>;

export type RelicMutationSchema = Record<string, RelicMutationWithHandler>;
