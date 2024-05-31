import { schema } from "./schema";
import { initRelicDefinition } from "@relic/core";
import { z } from "zod";

const d = initRelicDefinition().schema(schema);

export const relicDefinition = d.mutations({
    createReservation: d.mutation.input(
        z.object({
            id: z.string(),
            roomId: z.string(),
            start: z.coerce.date(),
            end: z.coerce.date(),
        })
    ),
    updateReservation: d.mutation.input(
        z.object({
            id: z.string(),
            start: z.coerce.date().optional(),
            end: z.coerce.date().optional(),
        })
    ),
    deleteReservation: d.mutation.input(z.string()),
});

export * from "./schema";
