import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { db, queryClient, relic } from "../client/relic";
import { issues } from "../db";
import { desc, eq, or, sql, count } from "drizzle-orm";
import { z } from "zod";

const params = z.object({
    page: z.number().default(1),
    filter: z.enum(["all", "active", "backlog"]).default("all"),
});

const sqlFilter = (filter: string) =>
    filter === "active"
        ? or(eq(issues.status, "todo"), eq(issues.status, "in_progress"))
        : filter === "backlog"
          ? eq(issues.status, "backlog")
          : undefined;

const issueListQuery = ({ filter, page }: z.infer<typeof params>) => {
    return relic.query(
        db
            .select()
            .from(issues)
            .orderBy(
                desc(
                    sql`IIF(${issues.priority} = 'urgent', 5,
                            IIF(${issues.priority} = 'high', 4,
                            IIF(${issues.priority} = 'medium', 3,
                            IIF(${issues.priority} = 'low', 2, 1))))`
                ),
                desc(issues.createdAt),
                desc(issues.id)
            )
            .limit(10)
            .offset((page - 1) * 10)
            .where(sqlFilter(filter))
    );
};

const issueCountQuery = ({ filter }: z.infer<typeof params>) => {
    return relic.query(
        db
            .select({
                count: count(),
            })
            .from(issues)
            .where(sqlFilter(filter))
    );
};

export const Route = createFileRoute("/")({
    validateSearch: params.parse,
    component: App,
    loaderDeps: ({ search }) => search,
    loader: async ({ deps }) => {
        await Promise.all([
            queryClient.ensureQueryData(issueListQuery(deps)),
            queryClient.ensureQueryData(issueCountQuery(deps)),
        ]);
    },
});

function App() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const { page, filter } = search;

    const { data: issuesList } = useSuspenseQuery(issueListQuery(search));

    const {
        data: [{ count: issueCount }],
    } = useSuspenseQuery(issueCountQuery(search));

    return (
        <div>
            <div>
                <h2>New issue</h2>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const title = formData.get("title") as string;

                        relic.mutate.createIssue({
                            id: crypto.randomUUID(),
                            title: title,
                            priority: "urgent",
                        });

                        (e.target as HTMLFormElement).reset();
                    }}
                >
                    <input type="text" name="title" />
                </form>
            </div>
            <div>
                <h2>Issues ({issueCount})</h2>
                <div>
                    <span>Filter</span>
                    <input
                        type="radio"
                        name="issueFilter"
                        id="issueFilterAll"
                        value="all"
                        checked={filter === "all"}
                        onChange={() => navigate({ search: { filter: "all" } })}
                    />
                    <label htmlFor="issueFilterAll">All</label>
                    <input
                        type="radio"
                        name="issueFilter"
                        id="issueFilterActive"
                        value="active"
                        checked={filter === "active"}
                        onChange={() =>
                            navigate({ search: { filter: "active" } })
                        }
                    />
                    <label htmlFor="issueFilterActive">Active</label>
                    <input
                        type="radio"
                        name="issueFilter"
                        id="issueFilterBacklog"
                        value="backlog"
                        checked={filter === "backlog"}
                        onChange={() =>
                            navigate({ search: { filter: "backlog" } })
                        }
                    />
                    <label htmlFor="issueFilterBacklog">Backlog</label>
                </div>
                <hr />
                <table style={{ width: "100%" }}>
                    <thead>
                        <tr style={{ textAlign: "left" }}>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Title</th>
                            <th>Last Modified</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {issuesList.map((issue) => (
                            <tr key={issue.id}>
                                <td>
                                    <select
                                        value={issue.priority}
                                        onChange={(e) =>
                                            relic.mutate.updateIssue({
                                                id: issue.id,
                                                priority: e.currentTarget
                                                    .value as typeof issue.priority,
                                            })
                                        }
                                    >
                                        <option value="none">None</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </td>
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
                                        <option value="in_progress">
                                            In Progress
                                        </option>
                                        <option value="done">Done</option>
                                        <option value="cancelled">
                                            Cancelled
                                        </option>
                                    </select>
                                </td>
                                <td>
                                    <Link
                                        to={"/issues/$id"}
                                        params={{
                                            id: issue.id,
                                        }}
                                    >
                                        {issue.title}
                                    </Link>{" "}
                                    <button
                                        onClick={() =>
                                            relic.mutate.updateIssue({
                                                id: issue.id,
                                                title:
                                                    prompt(
                                                        "New title",
                                                        issue.title
                                                    ) || "",
                                            })
                                        }
                                    >
                                        ✏️
                                    </button>
                                </td>
                                <td>
                                    {new Intl.DateTimeFormat(undefined, {
                                        dateStyle: "short",
                                        timeStyle: "medium",
                                    }).format(issue.modifiedAt)}
                                </td>
                                <td>
                                    <button
                                        onClick={() =>
                                            relic.mutate.deleteIssue(issue.id)
                                        }
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {issueCount > 10 && (
                    <div>
                        <button
                            disabled={page <= 1}
                            onClick={() =>
                                navigate({ search: { page: page - 1, filter } })
                            }
                        >
                            {"<"}
                        </button>
                        <span> Page {page} </span>
                        <button
                            disabled={page * 10 >= issueCount}
                            onClick={() =>
                                navigate({ search: { page: page + 1, filter } })
                            }
                        >
                            {">"}
                        </button>
                    </div>
                )}
            </div>
            <hr />
        </div>
    );
}
