import { createRootRoute, Outlet } from "@tanstack/react-router";
import { relic } from "../client/relic";
import { useSuspenseQuery } from "@tanstack/react-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).debug = () => relic.debug();

export const Route = createRootRoute({
    component: Root,
});

function Root() {
    const { data: pending } = useSuspenseQuery(relic.pendingMutations());
    return (
        <div>
            <div>{pending.length ? "Syncing..." : "Synced"}</div>
            <Outlet />
        </div>
    );
}
