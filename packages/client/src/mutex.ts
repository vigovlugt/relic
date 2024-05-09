// https://github.com/kysely-org/kysely/blob/e951eae475f9756a6a278d8de4baed85c92debc7/src/dialect/sqlite/sqlite-driver.ts#L115-L137
export class Mutex {
    private promise?: Promise<void>;
    private resolve?: () => void;

    async lock(): Promise<void> {
        while (this.promise) {
            await this.promise;
        }

        this.promise = new Promise((resolve) => {
            this.resolve = resolve;
        });
    }

    unlock(): void {
        const resolve = this.resolve;

        this.promise = undefined;
        this.resolve = undefined;

        resolve?.();
    }

    async withLock<T>(fn: () => Promise<T>): Promise<T> {
        await this.lock();
        let result: T | undefined = undefined;
        try {
            result = await fn();
        } finally {
            this.unlock();
        }

        return result;
    }
}
