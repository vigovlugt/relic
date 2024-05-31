import { relicDefinition, reservations } from "@mrs/shared";
import { ClientTx, initRelicClient } from "@relic/client";
import { and, eq, gt, lt, or } from "drizzle-orm";

const c = initRelicClient(relicDefinition).context<{ user: string }>();

async function getConflictingReservations(
    tx: ClientTx,
    roomId: string,
    start: Date,
    end: Date
) {
    return await tx
        .select()
        .from(reservations)
        .where(
            and(
                eq(reservations.roomId, roomId),
                or(
                    and(
                        lt(reservations.start, new Date(end)),
                        gt(reservations.end, new Date(start))
                    ),
                    and(
                        eq(reservations.start, new Date(end)),
                        eq(reservations.end, new Date(start))
                    )
                )
            )
        );
}

const createReservation = c.mutation.createReservation.mutate(
    async ({ tx, input, ctx }) => {
        const conflicts = await getConflictingReservations(
            tx,
            input.roomId,
            input.start,
            input.end
        );
        if (conflicts.length) {
            return;
        }

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
