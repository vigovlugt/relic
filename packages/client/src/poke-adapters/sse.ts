import { PokeAdapter } from "./poke-adapter";

export type SsePokeAdapterOptions = {
    url: string;
};

export function ssePokeAdapter({ url }: SsePokeAdapterOptions): PokeAdapter {
    const eventSource = new EventSource(url);

    return {
        onPoke(handler) {
            eventSource.onmessage = handler;
        },
        close() {
            eventSource.close();
        },
    };
}