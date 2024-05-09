import sqlite3InitModule, { Database } from "@sqlite.org/sqlite-wasm";
import {
    Command,
    CommandToCommandResponse,
    MessageResponse,
    SqlExecCommand,
} from "./shared";

async function createWorkerDb() {
    const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
    });
    const util = await sqlite3.installOpfsSAHPoolVfs({});
    const db = new util.OpfsSAHPoolDb("/db.sqlite3");

    const workerDb = new WorkerDb(db);

    return workerDb;
}

class WorkerDb {
    constructor(private db: Database) {
        this.postMessage({
            type: "initialized",
        });

        addEventListener("message", (event) => {
            const message = event.data as Command;
            this.onMessage(message);
        });
    }

    onMessage(message: Command) {
        switch (message.type) {
            case "exec":
                this.exec(message);
                break;
        }
    }

    postMessage(message: MessageResponse) {
        postMessage(message);
    }

    respondTo<T extends Command>(
        message: T,
        result: Omit<CommandToCommandResponse<T>, "messageId">
    ) {
        this.postMessage({
            ...result,
            messageId: message.messageId,
        } as CommandToCommandResponse<T>);
    }

    async exec(message: SqlExecCommand) {
        try {
            const result = this.db.exec(message.sql, {
                returnValue: "resultRows",
                bind: message.bind,
            });

            this.respondTo(message, {
                rows: result,
            });
        } catch (e) {
            if (e instanceof Error) {
                return this.respondTo(message, {
                    error: e,
                });
            }

            return this.respondTo(message, {
                error: new Error("Unknown sql exec error: " + e),
            });
        }
    }
}

createWorkerDb();
