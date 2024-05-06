import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { initRelicDefinition } from "../../../src/shared/relic-definition-builder";
import { initRelicClient } from "../../../src/client/relic-client-builder";
import { z } from "zod";
import { createRelicVanillaClient } from "../../../src/client/vanilla-client";
import { createSqliteWasmDb } from "../../../src/sqlite-wasm";
import { drizzle } from "../../../src/client/database/drizzle";
import { QueryClient } from "@tanstack/query-core";

// DEFINITION

const users = sqliteTable("users", {
    id: integer("id").notNull(),
    name: text("name").notNull(),
    age: integer("age").notNull(),
});

const schema = {
    users,
};

const definitionBuilder = initRelicDefinition()
    .schema(schema)
    .context<{ count: number }>();
const mutation = definitionBuilder.mutation;
const increment = mutation.mutate((opts) => {
    opts.context.count += 1;
});
const add = mutation.input(z.number()).mutate((opts) => {
    opts.context.count += opts.input;
});

const relicDefinition = definitionBuilder.mutations({
    increment,
    add,
});

// CLIENT

const clientBuilder = initRelicClient(relicDefinition).context<{
    name: string;
}>();

const clientIncrement = clientBuilder.mutation.increment.mutate((opts) => {
    opts.context.name += "!";
});
const clientAdd = clientBuilder.mutation.add.mutate(async (opts) => {
    await opts.tx.insert(users).values({
        id: 5,
        name: "Charlie",
        age: 18,
    });

    opts.context.count += opts.input;
    opts.context.name += "!";
});

const clientDefinition = clientBuilder.mutations({
    increment: clientIncrement,
    add: clientAdd,
});

// CLIENT INSTANCE

const context = { count: 0, name: "" };
const sqlite = await createSqliteWasmDb();
const db = drizzle(sqlite);
const queryClient = new QueryClient();

sqlite.exec(`
    DROP TABLE IF EXISTS _relic_rollback_log;
    DROP TABLE IF EXISTS _relic_mutation_queue;
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        age INTEGER
    );

    INSERT INTO users (id, name, age) VALUES ('1', 'Alice', 18);
    INSERT INTO users (id, name, age) VALUES ('2', 'Bob', 18);
`);

const relic = await createRelicVanillaClient({
    relicClient: clientDefinition,
    context,
    sqlite,
    queryClient,
});

console.log(await relic.query(db.select().from(users)));
