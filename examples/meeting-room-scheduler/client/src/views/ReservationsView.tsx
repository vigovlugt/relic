import { rooms } from "@mrs/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { startTransition } from "react";
import { relic, db } from "../relic";
import { ReservationsTable } from "../ReservationsTable";

export function Reservations({
    setSelectedRoom,
}: {
    setSelectedRoom: (id: string) => void;
}) {
    const { data: roomList } = useSuspenseQuery(
        relic.query(db.select().from(rooms))
    );
    const { data: reservationList } = useSuspenseQuery(
        relic.query(
            db.query.reservations.findMany({
                with: {
                    room: true,
                },
            })
        )
    );

    return (
        <div className="flex h-full">
            <div className="shrink-0 grow-0 w-[300px] p-3 bg-slate-50">
                <h2 className="font-bold text-lg">Rooms</h2>
                <ul>
                    {roomList.map((room) => (
                        <li
                            key={room.id}
                            className="font-semibold text-slate-800"
                        >
                            <button
                                onMouseDown={() =>
                                    startTransition(() =>
                                        setSelectedRoom(room.id)
                                    )
                                }
                            >
                                {room.name}
                            </button>
                        </li>
                    ))}
                </ul>
                <h2 className="font-bold text-lg mt-8">Create reservation</h2>
                <form
                    className="flex flex-col gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const formData = new FormData(form);

                        const roomId = formData.get("roomId") as string;
                        const start = new Date(formData.get("start") as string);
                        const end = new Date(formData.get("end") as string);

                        relic.mutate.createReservation({
                            id: crypto.randomUUID(),
                            roomId,
                            start,
                            end,
                        });
                    }}
                >
                    <fieldset className="flex flex-col gap-1">
                        <label>Room</label>
                        <select
                            name="roomId"
                            className="px-3 py-1 border rounded border-slate-200"
                        >
                            {roomList.map((room) => (
                                <option key={room.id} value={room.id}>
                                    {room.name}
                                </option>
                            ))}
                        </select>
                    </fieldset>
                    <fieldset className="flex flex-col gap-1">
                        <label>Start</label>
                        <input
                            className="px-3 py-1 border rounded border-slate-200"
                            name="start"
                            type="datetime-local"
                            defaultValue={new Date()
                                .toISOString()
                                .split(".")[0]
                                .split(":")
                                .slice(0, 2)
                                .join(":")}
                        />
                    </fieldset>
                    <fieldset className="flex flex-col gap-1">
                        <label>End</label>
                        <input
                            className="px-3 py-1 border rounded border-slate-200"
                            name="end"
                            type="datetime-local"
                            defaultValue={new Date(Date.now() + 60 * 60 * 1000)
                                .toISOString()
                                .split(".")[0]
                                .split(":")
                                .slice(0, 2)
                                .join(":")}
                        />
                    </fieldset>
                    <button
                        type="submit"
                        className="rounded bg-slate-900 px-4 py-2 w-min text-white"
                    >
                        Create
                    </button>
                </form>
            </div>
            <div className="flex-1 p-3">
                <h2 className="font-bold text-lg">Reservations</h2>
                <ReservationsTable reservationList={reservationList} />
            </div>
        </div>
    );
}
