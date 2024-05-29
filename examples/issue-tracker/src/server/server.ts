import { eq, inArray } from "drizzle-orm";
import { rowVersion, initRelicServer } from "@relic/server";
import {
    rowVersionDrizzleSqliteAdapter,
    ExtractTransaction,
} from "@relic/adapter-drizzle";
import { issues, comments } from "./db";
import { relicDefinition } from "../definition";
import { db } from "./main";
import { EventEmitter } from "events";

const s = initRelicServer(relicDefinition)
    .transaction<ExtractTransaction<typeof db>>()
    .context<{
        pokeEmitter: EventEmitter;
    }>();

const createIssue = s.mutation.createIssue.mutate(async ({ input, tx }) => {
    await tx.insert(issues).values(input);
});

const updateIssue = s.mutation.updateIssue.mutate(async ({ input, tx }) => {
    await tx.update(issues).set(input).where(eq(issues.id, input.id));
});

const deleteIssue = s.mutation.deleteIssue.mutate(async ({ input, tx }) => {
    await tx.delete(issues).where(eq(issues.id, input));
});

const createComment = s.mutation.createComment.mutate(async ({ input, tx }) => {
    if (input.body.includes("bad word")) {
        return;
    }

    await tx.insert(comments).values(input);
});

const updateComment = s.mutation.updateComment.mutate(async ({ input, tx }) => {
    await tx.update(comments).set(input).where(eq(comments.id, input.id));
});

const deleteComment = s.mutation.deleteComment.mutate(async ({ input, tx }) => {
    await tx.delete(comments).where(eq(comments.id, input));
});

function batch<T>(array: T[], size: number = 999) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
        batches.push(array.slice(i, i + size));
    }
    return batches;
}

async function mapBatched<T, U>(
    array: T[],
    callback: (batch: T[]) => Promise<U[]>,
    size?: number
) {
    const results = await Promise.all(batch(array, size).map(callback));
    return results.flat();
}

const puller = s.puller.pull(
    rowVersion(
        s.puller,
        rowVersionDrizzleSqliteAdapter(),
        async ({ tx }) => {
            return {
                issues: await tx
                    .select({
                        id: issues.id,
                        version: issues.version,
                    })
                    .from(issues),
                comments: await tx
                    .select({
                        id: comments.id,
                        version: comments.version,
                    })
                    .from(comments),
            };
        },
        async ({ tx, entities }) => {
            return {
                issues: await mapBatched(
                    entities.issues,
                    async (batch) =>
                        await tx
                            .select()
                            .from(issues)
                            .where(inArray(issues.id, batch))
                ),
                comments: await mapBatched(
                    entities.comments,
                    async (batch) =>
                        await tx
                            .select()
                            .from(comments)
                            .where(inArray(comments.id, batch))
                ),
            };
        }
    )
);

const poker = s.poker.poke(async ({ ctx }) => {
    ctx.pokeEmitter.emit("poke");
});

export const relicServer = s.pull(puller).poke(poker).mutations({
    createIssue,
    updateIssue,
    deleteIssue,
    createComment,
    updateComment,
    deleteComment,
});
