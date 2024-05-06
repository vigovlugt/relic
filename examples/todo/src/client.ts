import { eq, not } from "drizzle-orm";
import { initRelicClient } from "../../../src/client/relic-client-builder";
import { todos } from "./db";
import { relicDefintion as relicDefinition } from "./definition";

const c = initRelicClient(relicDefinition);

const addTodo = c.mutation.addTodo.mutate(async ({ input, tx }) => {
    await tx.insert(todos).values(input).returning({ id: todos.id }).get();
});

const deleteTodo = c.mutation.deleteTodo.mutate(async ({ input, tx }) => {
    await tx.delete(todos).where(eq(todos.id, input));
});

const toggleTodo = c.mutation.toggleTodo.mutate(async ({ input, tx }) => {
    await tx
        .update(todos)
        .set({
            isDone: not(todos.isDone),
        })
        .where(eq(todos.id, input));
});

const updateTodo = c.mutation.updateTodo.mutate(async ({ input, tx }) => {
    await tx
        .update(todos)
        .set({
            name: input.name,
        })
        .where(eq(todos.id, input.id));
});

export const relicClient = c.mutations({
    addTodo,
    deleteTodo,
    toggleTodo,
    updateTodo,
});
