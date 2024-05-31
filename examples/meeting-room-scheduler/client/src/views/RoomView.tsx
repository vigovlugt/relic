import { useSuspenseQuery } from "@tanstack/react-query";
import { db, relic } from "../relic";
import { startTransition } from "react";
import { ReservationsTable } from "../ReservationsTable";

export function Room(props: {
    id: string;
    setSelectedRoom: (id: string | null) => void;
}) {
    const { data } = useSuspenseQuery(
        relic.query(
            db.query.rooms.findFirst({
                where: ({ id }, { eq }) => eq(id, props.id),
                with: {
                    reservations: true,
                },
            })
        )
    );
    if (!data) {
        return "No room found";
    }

    return (
        <div>
            <div className="bg-slate-50 p-3 text-lg font-semibold flex items-center gap-3">
                <button
                    onClick={() =>
                        startTransition(() => props.setSelectedRoom(null))
                    }
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-arrow-left"
                    >
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
                    </svg>
                </button>
                <h2>{data.name}</h2>
            </div>
            <div className="p-3">
                <h2 className="text-lg font-semibold">Reservations</h2>
                <ReservationsTable
                    reservationList={data.reservations.map((r) => ({
                        ...r,
                        room: data,
                    }))}
                />
            </div>
        </div>
    );
}
