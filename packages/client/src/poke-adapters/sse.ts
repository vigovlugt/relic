import { PokeAdapter } from "./poke-adapter";

export type SsePokeAdapterOptions = {
    url: string;
};

export function ssePoker({ url }: SsePokeAdapterOptions): PokeAdapter {
    return (handler) => {
        const eventSource = new EventSource(url);
        eventSource.onmessage = handler;

        return () => {
            eventSource.close();
        };
    };
}
