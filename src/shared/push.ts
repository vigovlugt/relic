import { Mutation } from "./mutation";

export type RelicPushRequest = {
    mutations: Mutation[];
    clientId: string;
};
