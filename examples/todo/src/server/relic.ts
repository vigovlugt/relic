import { eq, not, inArray } from "drizzle-orm";
import { rowVersion, initRelicServer } from "@relic/server";
import {
    rowVersionDrizzleSqliteAdapter,
    ExtractTransaction,
} from "@relic/adapter-drizzle";
import { todos } from "./db";
import { relicDefinition } from "../relic/definition";
import { db } from "./server";
import { EventEmitter } from "events";

const s = initRelicServer(relicDefinition)
    .transaction<ExtractTransaction<typeof db>>()
    .context<{
        pokeEmitter: EventEmitter;
    }>();
const mutation = s.mutation;

const addTodo = mutation.addTodo.mutate(async ({ input, tx }) => {
    await tx.insert(todos).values(input);
});

const deleteTodo = mutation.deleteTodo.mutate(async ({ input, tx }) => {
    await tx.delete(todos).where(eq(todos.id, input));
});

const toggleTodo = mutation.toggleTodo.mutate(async ({ input, tx }) => {
    await tx
        .update(todos)
        .set({
            done: not(todos.done),
        })
        .where(eq(todos.id, input));
});

const updateTodo = mutation.updateTodo.mutate(async ({ input, tx }) => {
    await tx
        .update(todos)
        .set({
            name: input.name,
        })
        .where(eq(todos.id, input.id));
});

// const puller = s.puller.pull(async ({ tx }) => {
//     return {
//         clear: true,
//         entities: {
//             todos: {
//                 put: await tx.select().from(todos),
//                 delete: [],
//             },
//         },
//     };
// });

const puller = s.puller.pull(
    rowVersion(
        s.puller,
        rowVersionDrizzleSqliteAdapter(),
        async ({ tx }) => {
            return {
                todos: await tx
                    .select({
                        id: todos.id,
                        version: todos.version,
                    })
                    .from(todos),
            };
        },
        async ({ tx, entities }) => {
            return {
                todos: entities.todos.length
                    ? await tx
                          .select()
                          .from(todos)
                          .where(inArray(todos.id, entities.todos))
                    : [],
            };
        }
    )
);

const poker = s.poker.poke(async ({ ctx }) => {
    ctx.pokeEmitter.emit("poke");
});

export const relicServer = s.pull(puller).poke(poker).mutations({
    addTodo,
    deleteTodo,
    toggleTodo,
    updateTodo,
});
