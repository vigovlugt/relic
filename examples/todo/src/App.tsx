import { useSuspenseQuery } from "@tanstack/react-query";
import { db, relic } from "./relic/relic";
import { todos } from "./db";
import { desc } from "drizzle-orm";

function App() {
    const { data: todoList } = useSuspenseQuery(
        relic.queryOptions(
            db.select().from(todos).orderBy(desc(todos.createdAt))
        )
    );
    console.log(todoList);

    return (
        <div>
            <div>
                <h2>New todo</h2>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(
                            e.target as HTMLFormElement
                        );
                        const name = formData.get("name") as string;
                        relic.mutate.addTodo({
                            id: crypto.randomUUID(),
                            name,
                            done: false,
                        });

                        (e.target as HTMLFormElement).reset();
                    }}
                >
                    <input type="text" name="name" />
                </form>
            </div>
            <div>
                <h2>Todos</h2>
                <ul>
                    {todoList.map((todo) => (
                        <li key={todo.id}>
                            <input
                                type="checkbox"
                                checked={todo.done}
                                onChange={() =>
                                    relic.mutate.toggleTodo(todo.id)
                                }
                            />
                            <span>{todo.name} </span>
                            <button
                                onClick={() => relic.mutate.deleteTodo(todo.id)}
                            >
                                X
                            </button>
                            <button
                                onClick={() =>
                                    relic.mutate.updateTodo({
                                        id: todo.id,
                                        name:
                                            prompt("New name", todo.name) || "",
                                    })
                                }
                            >
                                Rename
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            {/* <button onClick={() => relic.debug()}>Debug</button>
            <button
                onClick={async () => {
                    console.time("pull");
                    await relic.pull();
                    console.timeEnd("pull");
                }}
            >
                Pull
            </button>
            <button
                onClick={async () => {
                    console.time("push");
                    await relic.push();
                    console.timeEnd("push");
                }}
            >
                Push
            </button> */}
        </div>
    );
}

export default App;
