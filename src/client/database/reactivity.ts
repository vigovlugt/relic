// TODO: is this needed with Tanstack Query?
// Fine grained difficult, as integration with drizzle is needed.
export class ReactiveManager {
    subscriptions: Set<() => void> = new Set();

    invalidateAll() {
        for (const callback of this.subscriptions) {
            callback();
        }
    }

    subscribe(callback: () => void) {
        this.subscriptions.add(callback);
        callback();

        return () => {
            this.subscriptions.delete(callback);
        };
    }
}
