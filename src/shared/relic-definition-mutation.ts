import { RelicMutationInput } from "../relic-mutation";
import { RelicContext } from "./relic-definition-builder";

export type RelicDefinitionMutationHandlerOptions<
    TDef extends RelicContext,
    TInput extends RelicMutationInput
> = {
    input: TInput;
    context: TDef["_"]["context"];
};
