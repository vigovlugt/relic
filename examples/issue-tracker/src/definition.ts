import { initRelicDefinition } from "@relic/core";
import { schema, issues, comments } from "./db";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

const d = initRelicDefinition().schema(schema);
const mutation = d.mutation;

const insertIssueSchema = createInsertSchema(issues);
const updateIssueSchema = createSelectSchema(issues)
    .omit({ id: true, createdAt: true, modifiedAt: true })
    .partial()
    .merge(
        z.object({
            id: z.string(),
        })
    );

const insertCommentSchema = createInsertSchema(comments);
const updateCommentSchema = createSelectSchema(comments)
    .omit({ id: true, issueId: true, createdAt: true })
    .partial()
    .merge(
        z.object({
            id: z.string(),
        })
    );

export const relicDefinition = d.mutations({
    createIssue: mutation.input(insertIssueSchema),
    updateIssue: mutation.input(updateIssueSchema),
    deleteIssue: mutation.input(z.string()),

    createComment: mutation.input(insertCommentSchema),
    updateComment: mutation.input(updateCommentSchema),
    deleteComment: mutation.input(z.string()),
});
