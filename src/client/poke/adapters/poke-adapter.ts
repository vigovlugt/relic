export type PokeAdapter = {
    onPoke: (handler: () => void) => void;
    close: () => void;
};
