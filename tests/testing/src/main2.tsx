import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import {
    RelicContext,
    initRelicDefinition,
} from "../../../src/shared/relic-definition-builder";
import { initRelicClient } from "../../../src/client/relic-client-builder";
import * as z from "zod";
import { RelicMutation } from "../../../src/relic-mutation";

const users = sqliteTable("users", {
    id: text("id"),
    name: text("name"),
    age: integer("age"),
});

const teams = sqliteTable("teams", {
    id: text("id"),
    name: text("name"),
});

const schema = {
    users,
    teams,
};

const relicDefinitionContext = initRelicDefinition()
    .schema(schema)
    .context<{ count: number }>();

const mutation = relicDefinitionContext.mutation;
const increment = mutation.mutate((opts) => {
    opts.context.count += 1;
});

increment satisfies RelicMutation;
const c = { count: 0 };
c satisfies RelicContext;

const relicDefinition = relicDefinitionContext.mutations({
    increment,
});

const relicClient = initRelicClient(relicDefinition);
