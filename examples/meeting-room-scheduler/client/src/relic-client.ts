import { relicDefinition, reservations } from "@mrs/shared";
import { initRelicClient } from "@relic/client";
import { eq } from "drizzle-orm";

const c = initRelicClient(relicDefinition).context<{ user: string }>();

const createReservation = c.mutation.createReservation.mutate(
    async ({ tx, input, ctx }) => {
        await tx
            .insert(reservations)
            .values({ ...input, owner: ctx.user })
            .execute();
    }
);

const updateReservation = c.mutation.updateReservation.mutate(
    async ({ tx, input }) => {
        await tx
            .update(reservations)
            .set(input)
            .where(eq(reservations.id, input.id))
            .execute();
    }
);

const deleteReservation = c.mutation.deleteReservation.mutate(
    async ({ tx, input }) => {
        await tx
            .delete(reservations)
            .where(eq(reservations.id, input))
            .execute();
    }
);

export const relicClient = c.mutations({
    createReservation,
    updateReservation,
    deleteReservation,
});
