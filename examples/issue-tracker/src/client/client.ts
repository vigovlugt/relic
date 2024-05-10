import { eq } from "drizzle-orm";
import { initRelicClient } from "@relic/client";
import { issues, comments } from "../db";
import { relicDefinition } from "../definition";

const c = initRelicClient(relicDefinition);

const createIssue = c.mutation.createIssue.mutate(async ({ input, tx }) => {
    await tx.insert(issues).values(input);
});

const updateIssue = c.mutation.updateIssue.mutate(async ({ input, tx }) => {
    await tx.update(issues).set(input).where(eq(issues.id, input.id));
});

const deleteIssue = c.mutation.deleteIssue.mutate(async ({ input, tx }) => {
    await tx.delete(issues).where(eq(issues.id, input));
});

const createComment = c.mutation.createComment.mutate(async ({ input, tx }) => {
    await tx.insert(comments).values(input);
});

const updateComment = c.mutation.updateComment.mutate(async ({ input, tx }) => {
    await tx.update(comments).set(input).where(eq(comments.id, input.id));
});

const deleteComment = c.mutation.deleteComment.mutate(async ({ input, tx }) => {
    await tx.delete(comments).where(eq(comments.id, input));
});

export const relicClient = c.mutations({
    createIssue,
    updateIssue,
    deleteIssue,
    createComment,
    updateComment,
    deleteComment,
});
