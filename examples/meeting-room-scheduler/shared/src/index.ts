import { schema } from "./schema";
import { initRelicDefinition } from "@relic/core";
import { z } from "zod";

const d = initRelicDefinition().schema(schema);

const createReservation = d.mutation.input(
    z.object({
        id: z.string(),
        roomId: z.string(),
        start: z.coerce.date(),
        end: z.coerce.date(),
    })
);

const updateReservation = d.mutation.input(
    z.object({
        id: z.string(),
        start: z.coerce.date().optional(),
        end: z.coerce.date().optional(),
    })
);

const deleteReservation = d.mutation.input(z.string());

export const relicDefinition = d.mutations({
    createReservation,
    updateReservation,
    deleteReservation,
});

export * from "./schema";
