import { initRelicDefinition } from "@relic/core";
import z from "zod";
import { todos } from "../db";

const d = initRelicDefinition().schema({
    todos,
});
const mutation = d.mutation;

export const relicDefinition = d.mutations({
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
