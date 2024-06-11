import { BindingSpec, SqlValue } from "@sqlite.org/sqlite-wasm";

export type BaseCommand = {
    messageId: string;
};

export type SqlExecCommand = BaseCommand & {
    type: "exec";
    sql: string;
    bind?: BindingSpec;
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

export type InitializedMessage = {
    type: "initialized";
};

export type Command = SqlExecCommand | CloseCommand | RemoveCommand;
export type CommandResponse = CommandToCommandResponse<Command>;

export type CommandToCommandResponse<T extends Command> = {
    exec: SqlExecCommandResponse;
    close: BaseCommand;
    remove: BaseCommand;
}[T["type"]];

export type MessageResponse = CommandResponse | InitializedMessage;
