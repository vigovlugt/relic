import sqlite3InitModule, {
    Database,
    SAHPoolUtil,
} from "@sqlite.org/sqlite-wasm";
import {
    CloseCommand,
    Command,
    CommandToCommandResponse,
    MessageResponse,
    RemoveCommand,
    SqlExecCommand,
} from "./shared";

async function createWorkerDb() {
    const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
    });
    const util = await sqlite3.installOpfsSAHPoolVfs({});
    const db = new util.OpfsSAHPoolDb("/db.sqlite3");

    const workerDb = new WorkerDb(db, util);

    return workerDb;
}

class WorkerDb {
    private isClosed = false;

    constructor(
        private db: Database,
        private util: SAHPoolUtil
    ) {
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
            case "close":
                this.close(message);
                break;
            case "remove":
                this.remove(message);
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
        if (this.isClosed) {
            return this.respondTo(message, {
                error: new Error("Database is closed"),
            });
        }

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

    async close(message: CloseCommand) {
        try {
            this.isClosed = true;
            this.db.close();
            this.respondTo(message, {});
        } catch (e) {
            if (e instanceof Error) {
                return this.respondTo(message, {
                    error: e,
                });
            }

            return this.respondTo(message, {
                error: new Error("Unknown close error: " + e),
            });
        }
    }

    async remove(message: RemoveCommand) {
        try {
            await this.util.removeVfs();
            this.respondTo(message, {});
        } catch (e) {
            if (e instanceof Error) {
                return this.respondTo(message, {
                    error: e,
                });
            }

            return this.respondTo(message, {
                error: new Error("Unknown remove error: " + e),
            });
        }
    }
}

createWorkerDb();
