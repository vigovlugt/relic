import {
    Command,
    MessageResponse,
    CommandToCommandResponse,
    CommandResponse,
} from "./shared";
import { SqliteDb } from "../client/database";
import { BindingSpec } from "@sqlite.org/sqlite-wasm";

export async function createSqliteWasmDb() {
    const worker = new Worker(new URL("worker.ts", import.meta.url), {
        type: "module",
    });

    await new Promise<void>((resolve) => {
        worker.onmessage = (event) => {
            const message = event.data as MessageResponse;
            if ("type" in message && message.type === "initialized") {
                resolve();
                return;
            }
        };
    });

    const db = new SQLiteWasmDb(worker);

    return db;
}

export class SQLiteWasmDb implements SqliteDb {
    private worker: Worker;

    private commandCallbacks = new Map<string, (response: Command) => void>();

    constructor(worker: Worker) {
        this.worker = worker;

        this.worker.onmessage = (event) => {
            const message = event.data as MessageResponse;

            if ("messageId" in message) {
                const callback = this.commandCallbacks.get(message.messageId);
                if (callback) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    callback(message as any);
                } else {
                    console.error("No callback for message", message);
                }
            }
        };
    }

    private postMessage(message: Command) {
        this.worker.postMessage(message);
    }

    private async sendCommand<T extends Command>(
        message: Omit<T, "messageId">
    ): Promise<CommandToCommandResponse<T>> {
        const messageId = crypto.randomUUID();

        return new Promise((resolve) => {
            const listener = (response: CommandResponse) => {
                resolve(response);
                this.commandCallbacks.delete(messageId);
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.commandCallbacks.set(messageId, listener as any);
            this.postMessage({
                ...message,
                messageId,
            });
        });
    }

    async exec(sql: string, bind?: BindingSpec) {
        // console.log("exec", sql, bind);
        const response = await this.sendCommand({
            type: "exec",
            bind,
            sql,
        });

        if ("error" in response) {
            throw response.error;
        }

        return {
            rows: response.rows,
        };
    }
}
