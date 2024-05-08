import { RelicServer } from "./relic-server";
import z from "zod";
import { RelicServerDatabase } from "./relic-server-database";

export type RelicRequestHandlerOptions<
    TServer extends RelicServer = RelicServer
> = {
    relicServer: TServer;
    req: Request;
    database: RelicServerDatabase<TServer["_"]["tx"]>;
} & // Only require context if it's needed
(TServer["_"]["context"] extends Record<string, never>
    ? Record<string, never>
    : { context: TServer["_"]["context"] });

export const relicPullRequest = z.object({
    clientId: z.string(),
    version: z.string(),
});

export const relicPushRequest = z.object({
    mutations: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            input: z.any(),
        })
    ),
    clientId: z.string(),
});

export async function relicRequestHandler<TServer extends RelicServer>(
    opts: RelicRequestHandlerOptions<TServer>
): Promise<Response> {
    const parts = opts.req.url.split("/");
    switch (parts[parts.length - 1].toLowerCase()) {
        case "push":
            return handlePush(opts);
        case "pull":
            return handlePull(opts);
        default:
            return new Response("Not found", { status: 404 });
    }
}

async function handlePull<TServer extends RelicServer>({
    relicServer,
    context,
    database,
    req,
}: RelicRequestHandlerOptions<TServer>) {
    const body = await req.json();
    const { success, data, error } = relicPullRequest.safeParse(body);
    if (!success) {
        return new Response(
            JSON.stringify({
                error: "Invalid request",
                issues: error.issues,
            }),
            { status: 400 }
        );
    }

    try {
        const response = await relicServer.pull({
            ctx: context,
            req: data,
            database,
        });

        return new Response(JSON.stringify(response), {
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
}

async function handlePush<TServer extends RelicServer>({
    relicServer,
    context,
    database,
    req,
}: RelicRequestHandlerOptions<TServer>) {
    const body = await req.json();
    const { success, data, error } = relicPushRequest.safeParse(body);
    if (!success) {
        return new Response(
            JSON.stringify({
                error: "Invalid request",
                issues: error.issues,
            }),
            { status: 400 }
        );
    }

    try {
        await relicServer.push({ ctx: context, req: data, database });
    } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    return new Response(undefined, {
        headers: {
            "Content-Type": "application/json",
        },
    });
}
