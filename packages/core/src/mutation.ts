export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonObject
    | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type Mutation = {
    id: number;
    name: string;
    input?: JsonValue;
};
