import { InferSelectModel } from "drizzle-orm";
import { RelicContext, RelicSchema } from "@relic/core";
import {
    RelicPullBuilder,
    RelicPullHandler,
    RelicPullHandlerOptions,
    RelicPullHandlerResult,
} from "../pull";

export type RowVersionClientView<TSchema extends RelicSchema> = {
    [K in keyof TSchema]: Record<string, number>;
};

export type RowVersionClientViewDiff<TSchema extends RelicSchema> = {
    [K in keyof TSchema]: {
        put: string[];
        delete: string[];
    };
};

export type RowVersionFetchViewResult<TSchema extends RelicSchema> = {
    [K in keyof TSchema]: { id: string; version: number }[];
};

export type RowVersionFetchViewFn<
    TSchema extends RelicSchema,
    TContext extends RelicContext,
    TTx
> = (
    opts: RelicPullHandlerOptions<TContext, TTx>
) =>
    | Promise<RowVersionFetchViewResult<TSchema>>
    | RowVersionFetchViewResult<TSchema>;

export type RowVersionEntities<TSchema extends RelicSchema> = {
    [K in keyof TSchema]: InferSelectModel<TSchema[K]>[];
};

export type RowVersionFetchEntitiesFn<
    TSchema extends RelicSchema,
    TContext extends RelicContext,
    TTx
> = (
    opts: RelicPullHandlerOptions<TContext, TTx> & {
        entities: {
            [K in keyof TSchema]: string[];
        };
    }
) => Promise<RowVersionEntities<TSchema>> | RowVersionEntities<TSchema>;

export type RowVersionDbAdapter<TTx> = {
    getClientView: (
        tx: TTx,
        clientId: string,
        viewId: number
    ) => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Promise<RowVersionClientView<any> | undefined>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | RowVersionClientView<any>
        | undefined;
    createClientView: (
        tx: TTx,
        clientId: string,
        viewId: number,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view: RowVersionClientView<any>
    ) => Promise<void> | void;
    deleteClientViews: (
        tx: TTx,
        clientId: string,
        maxViewId: number
    ) => Promise<void> | void;
};

export function rowVersion<
    TSchema extends RelicSchema,
    TContext extends RelicContext,
    TTx
>(
    // Require pull builder for type inference
    _: RelicPullBuilder<TSchema, TContext, TTx>,
    db: RowVersionDbAdapter<TTx>,
    fetchView: RowVersionFetchViewFn<TSchema, TContext, TTx>,
    fetchPutEntities: RowVersionFetchEntitiesFn<TSchema, TContext, TTx>
) {
    const fn = (async (opts) => {
        const version = opts.version === null ? 1 : Number(opts.version);
        const nextVersion = version + 1;

        // Get old client view record
        // Get new client view record
        const [oldClientView, newClientViewResult] = await Promise.all([
            opts.version
                ? db.getClientView(opts.tx, opts.clientId, version)
                : undefined,
            fetchView(opts),
        ]);

        const newClientView = Object.fromEntries(
            Object.entries(newClientViewResult).map(([table, entities]) => [
                table,
                Object.fromEntries(entities.map((e) => [e.id, e.version])),
            ])
        ) as RowVersionClientView<TSchema>;

        // Get difference between old and new client view record
        const diff = calculateClientViewDiff(
            oldClientView ?? {},
            newClientView
        );

        // Return early if no changes
        if (clientDiffEmpty(diff) && oldClientView !== undefined) {
            return {
                clear: false,
                entities: {},
                version,
            };
        }

        // Fetch changedEntities
        const entities = await fetchPutEntities({
            ...opts,
            entities: Object.fromEntries(
                Object.entries(diff).map(([table, v]) => [table, v.put])
            ) as { [K in keyof TSchema]: string[] },
        });

        // Store new client view record
        await db.createClientView(
            opts.tx,
            opts.clientId,
            nextVersion,
            newClientView
        );

        // Do not delete currentClientView, as client may not receive response with new viewId due to network issues
        await db.deleteClientViews(opts.tx, opts.clientId, nextVersion - 2);

        const pullEntities = Object.fromEntries(
            Object.entries(entities).map(([table, v]) => [
                table,
                {
                    put: v,
                    delete: diff[table]!.delete,
                },
            ])
        ) as RelicPullHandlerResult<TSchema>["entities"];

        return {
            clear: oldClientView === undefined,
            entities: pullEntities,
            version: String(nextVersion),
        };
    }) as RelicPullHandler<TSchema, TContext, TTx>;

    return fn;
}

export function calculateClientViewDiff<TSchema extends RelicSchema>(
    oldView: Partial<RowVersionClientView<TSchema>>,
    newView: RowVersionClientView<TSchema>
): RowVersionClientViewDiff<TSchema> {
    return Object.fromEntries(
        Object.entries(newView).map(([table, newEntities]) => {
            const oldEntities = oldView[table] ?? {};
            const oldEntityIds = Object.keys(oldEntities);

            const newEntityIds = Object.keys(newEntities);
            const newEntityIdSet = new Set(newEntityIds);

            const put = newEntityIds.filter((id) => {
                const oldVersion = oldEntities[id];
                const newVersion = newEntities[id];
                return oldVersion !== newVersion;
            });

            const deleteIds = oldEntityIds.filter(
                (id) => !newEntityIdSet.has(id)
            );

            return [table, { put, delete: deleteIds }];
        })
    ) as RowVersionClientViewDiff<TSchema>;
}

export function clientDiffEmpty<TSchema extends RelicSchema>(
    diff: RowVersionClientViewDiff<TSchema>
) {
    return Object.values(diff).every(
        (v) => v.put.length === 0 && v.delete.length === 0
    );
}
