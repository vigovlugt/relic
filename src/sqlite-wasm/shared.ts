import { BindingSpec, SqlValue } from "@sqlite.org/sqlite-wasm";

export type BaseCommand = {
    messageId: string;
};

export type SqlExecCommand = BaseCommand & {
    type: "exec";
    sql: string;
    bind?: BindingSpec;
};

export type SqlExecCommandResponse = BaseCommand & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: SqlValue[][];
};

export type InitializedMessage = {
    type: "initialized";
};

export type Command = SqlExecCommand;
export type CommandResponse = CommandToCommandResponse<Command>;

export type CommandToCommandResponse<T extends Command> = {
    exec: SqlExecCommandResponse;
}[T["type"]];

export type MessageResponse = CommandResponse | InitializedMessage;
