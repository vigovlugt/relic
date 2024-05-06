import { initRelicDefinition } from "../../../src/shared/relic-definition-builder";
import z from "zod";
import { todos } from "./db";

const r = initRelicDefinition().schema({
    todos,
});
const mutation = r.mutation;

export const relicDefintion = r.mutations({
    addTodo: mutation.input(
        z.object({
            id: z.string(),
            name: z.string(),
            done: z.boolean(),
        })
    ),

    deleteTodo: mutation.input(z.string()),

    toggleTodo: mutation.input(z.string()),

    updateTodo: mutation.input(
        z.object({
            id: z.string(),
            name: z.string(),
        })
    ),
});
