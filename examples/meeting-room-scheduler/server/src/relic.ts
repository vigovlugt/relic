import { relicDefinition } from "@mrs/shared";
import {
    ExtractTransaction,
    rowVersionPostgresAdapter,
} from "@relic/adapter-drizzle";
import { initRelicServer, rowVersion } from "@relic/server";
import { db } from "./index";
import { reservations, rooms } from "./db";
import { eq, inArray, lt, gt, and, or } from "drizzle-orm";
import EventEmitter from "events";

type Tx = ExtractTransaction<typeof db>;

const s = initRelicServer(relicDefinition)
    .transaction<Tx>()
    .context<{ user: string; pokeEmitter: EventEmitter }>();

async function getConflictingReservations(
    tx: Tx,
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

const createReservation = s.mutation.createReservation.mutate(
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

        await tx.insert(reservations).values({
            ...input,
            owner: ctx.user,
        });
    }
);

const deleteReservation = s.mutation.deleteReservation.mutate(
    async ({ tx, input }) => {
        await tx.delete(reservations).where(eq(reservations.id, input));
    }
);

const updateReservation = s.mutation.updateReservation.mutate(
    async ({ tx, input }) => {
        await tx
            .update(reservations)
            .set({
                ...input,
                start: input.start,
                end: input.end,
            })
            .where(eq(reservations.id, input.id));
    }
);

const puller = s.puller.pull(
    rowVersion(
        s.puller,
        rowVersionPostgresAdapter(),
        async ({ tx }) => {
            return {
                reservations: await tx
                    .select({
                        id: reservations.id,
                        version: reservations.version,
                    })
                    .from(reservations),
                rooms: await tx
                    .select({
                        id: rooms.id,
                        version: rooms.version,
                    })
                    .from(rooms),
            };
        },
        async ({ tx, entities }) => {
            return {
                reservations: entities.reservations.length
                    ? await tx
                          .select()
                          .from(reservations)
                          .where(
                              inArray(reservations.id, entities.reservations)
                          )
                    : [],
                rooms: entities.rooms.length
                    ? await tx
                          .select()
                          .from(rooms)
                          .where(inArray(rooms.id, entities.rooms))
                    : [],
            };
        }
    )
);

const poker = s.poker.poke(async ({ ctx }) => {
    ctx.pokeEmitter.emit("poke");
});

export const relicServer = s.pull(puller).poke(poker).mutations({
    createReservation,
    deleteReservation,
    updateReservation,
});
