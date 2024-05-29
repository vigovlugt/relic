import { initRelicDefinition } from "@relic/core";
import { schema, issues, comments, PRIORITIES, STATUSES } from "./db";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const d = initRelicDefinition().schema(schema);
const mutation = d.mutation;

const insertIssueSchema = createInsertSchema(issues);
const updateIssueSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(STATUSES).optional(),
    id: z.string(),
});

const insertCommentSchema = createInsertSchema(comments);
const updateCommentSchema = z.object({
    id: z.string(),
    body: z.string().optional(),
});

export const relicDefinition = d.mutations({
    createIssue: mutation.input(insertIssueSchema),
    updateIssue: mutation.input(updateIssueSchema),
    deleteIssue: mutation.input(z.string()),

    createComment: mutation.input(insertCommentSchema),
    updateComment: mutation.input(updateCommentSchema),
    deleteComment: mutation.input(z.string()),
});
