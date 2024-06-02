import { InferSelectModel } from "drizzle-orm";
import { reservations, rooms } from "@mrs/shared";
import { formatDate } from "./utils";
import { relic } from "./relic";

export function ReservationsTable({
    reservationList,
}: {
    reservationList: (InferSelectModel<typeof reservations> & {
        room: InferSelectModel<typeof rooms>;
    })[];
}) {
    return (
        <table className="min-w-full divide-y divide-gray-300">
            <thead>
                <tr>
                    <th className="py-3.5 pl-0 pr-3 text-left text-sm font-semibold">
                        Room
                    </th>
                    <th className="py-3.5 pl-3 pr-3 text-left text-sm font-semibold">
                        Owner
                    </th>
                    <th className="py-3.5 pl-3 pr-3 text-left text-sm font-semibold">
                        Start
                    </th>
                    <th className="py-3.5 pl-3 pr-3 text-left text-sm font-semibold">
                        End
                    </th>
                    <th className="py-3.5 pl-3 pr-0 text-left text-sm font-semibold"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
                {reservationList.map((reservation) => (
                    <tr key={reservation.id}>
                        <td className="whitespace-nowrap px-3 pl-0 py-3 text-sm">
                            {reservation.room.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                            {reservation.owner}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                            {formatDate(reservation.start)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                            {formatDate(reservation.end)}
                        </td>
                        <td className="whitespace-nowrap px-3 pr-0 py-3 text-sm">
                            <button
                                className="rounded bg-slate-900 px-3 py-1 text-white"
                                onClick={() => {
                                    relic.mutate.deleteReservation(
                                        reservation.id
                                    );
                                }}
                            >
                                Delete
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
