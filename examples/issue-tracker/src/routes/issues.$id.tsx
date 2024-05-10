import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { db, queryClient, relic } from "../client/relic";
import { eq, desc } from "drizzle-orm";
import { comments, issues } from "../db";

const query = (id: string) =>
    relic.query(
        db.query.issues.findFirst({
            where: eq(issues.id, id),
            with: {
                comments: {
                    orderBy: desc(comments.createdAt),
                },
            },
        })
    );

export const Route = createFileRoute("/issues/$id")({
    component: Issue,
    loader: async ({ params }) =>
        await queryClient.ensureQueryData(query(params.id)),
});

function Issue() {
    const { id } = Route.useParams();
    const { data: issue } = useSuspenseQuery(query(id));

    if (!issue) {
        return <span>Issue not found</span>;
    }

    return (
        <div>
            <h1>{issue.title}</h1>
            <table>
                <tbody>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Priority</td>
                        <td>
                            <select
                                value={issue.priority}
                                onChange={(e) => {
                                    relic.mutate.updateIssue({
                                        id: issue.id,
                                        priority: e.currentTarget
                                            .value as typeof issue.priority,
                                    });
                                }}
                            >
                                <option value="none">None</option>
                                <option value="urgent">Urgent</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Status</td>
                        <td>
                            <select
                                value={issue.status}
                                onChange={(e) => {
                                    relic.mutate.updateIssue({
                                        id: issue.id,
                                        status: e.currentTarget
                                            .value as typeof issue.status,
                                    });
                                }}
                            >
                                <option value="backlog">Backlog</option>
                                <option value="todo">Todo</option>
                                <option value="in_progress">In Progress</option>
                                <option value="done">Done</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Created</td>
                        <td>
                            {new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                            }).format(issue.createdAt)}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Modified</td>
                        <td>
                            {new Intl.DateTimeFormat(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                            }).format(issue.modifiedAt)}
                        </td>
                    </tr>
                </tbody>
            </table>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const body = formData.get("body") as string;

                    relic.mutate.createComment({
                        id: crypto.randomUUID(),
                        issueId: issue.id,
                        body,
                    });

                    (e.target as HTMLFormElement).reset();
                }}
            >
                <h2>New comment</h2>
                <textarea name="body"></textarea>
                <button type="submit">Post</button>
            </form>
            <div>
                <h2>Comments</h2>
                <ul>
                    {issue.comments.map((comment) => (
                        <li key={comment.id}>
                            <pre>{comment.body}</pre>
                            <button
                                onClick={() =>
                                    relic.mutate.updateComment({
                                        id: comment.id,
                                        body:
                                            prompt("New body", comment.body) ||
                                            "",
                                    })
                                }
                            >
                                Edit
                            </button>
                            <button
                                onClick={() =>
                                    relic.mutate.deleteComment(comment.id)
                                }
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
