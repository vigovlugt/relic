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
            <Outlet />
            <details
                style={{
                    position: "absolute",
                    bottom: "8px",
                    left: "8px",
                }}
            >
                <summary>Mutation queue</summary>
                <table>
                    <thead>
                        <tr>
                            <td>Id</td>
                            <td>Name</td>
                            <td>Input</td>
                        </tr>
                    </thead>
                    <tbody>
                        {pending?.map((mutation) => (
                            <tr key={mutation.id}>
                                <td>{mutation.id}</td>
                                <td>{mutation.name}</td>
                                <td>{JSON.stringify(mutation.input)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </div>
    );
}
