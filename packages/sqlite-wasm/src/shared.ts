import { BindingSpec, SqlValue } from "@sqlite.org/sqlite-wasm";

export type BaseCommand = {
    messageId: string;
};

export type SqlExecCommand = BaseCommand & {
    type: "exec";
    sql: string;
    bind?: BindingSpec;
};

export type SqlBatchExecCommand = BaseCommand & {
    type: "execBatch";
    execs: [string, BindingSpec | undefined][];
};

export type CloseCommand = BaseCommand & {
    type: "close";
};

export type RemoveCommand = BaseCommand & {
    type: "remove";
};

export type SqlExecCommandResponse = BaseCommand &
    (
        | {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows: SqlValue[][];
          }
        | {
              error: Error;
          }
    );

export type SqlBatchExecCommandResponse = BaseCommand &
    (
        | {
              rows: SqlValue[][][];
          }
        | { error: Error }
    );

export type InitializedMessage = {
    type: "initialized";
};

export type Command =
    | SqlExecCommand
    | CloseCommand
    | RemoveCommand
    | SqlBatchExecCommand;
export type CommandResponse = CommandToCommandResponse<Command>;

export type CommandToCommandResponse<T extends Command> = {
    exec: SqlExecCommandResponse;
    close: BaseCommand;
    remove: BaseCommand;
    execBatch: SqlBatchExecCommandResponse;
}[T["type"]];

export type MessageResponse = CommandResponse | InitializedMessage;
