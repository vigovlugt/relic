import { useSuspenseQuery } from "@tanstack/react-query";
import { db, relic } from "./relic";
import { reservations, rooms } from "@mrs/shared";

function formatDate(date: Date) {
    return Intl.DateTimeFormat(undefined, {
        year: "2-digit",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function App() {
    const { data: roomList } = useSuspenseQuery(
        relic.query(db.select().from(rooms))
    );
    const { data: reservationList } = useSuspenseQuery(
        relic.query(db.select().from(reservations))
    );

    return (
        <div>
            <h2>Rooms</h2>
            <ul>
                {roomList.map((room) => (
                    <li key={room.id}>{room.name}</li>
                ))}
            </ul>
            <h2>Reservations</h2>
            {reservationList.length > 0 && (
                <ul>
                    {reservationList.map((reservation) => (
                        <li key={reservation.id}>
                            {reservation.owner} -{" "}
                            {formatDate(reservation.start)} -{" "}
                            {formatDate(reservation.end)}{" "}
                            <button
                                onClick={() => {
                                    relic.mutate.deleteReservation(
                                        reservation.id
                                    );
                                }}
                            >
                                X
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {reservationList.length === 0 && <span>No reservations</span>}
            <h2>Create reservation</h2>
            <form
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

                    form.reset();
                }}
            >
                <label>Room</label>
                <br />
                <select name="roomId">
                    {roomList.map((room) => (
                        <option key={room.id} value={room.id}>
                            {room.name}
                        </option>
                    ))}
                </select>
                <br />
                <br />
                <label>Start</label>
                <br />
                <input
                    name="start"
                    type="datetime-local"
                    defaultValue={new Date()
                        .toISOString()
                        .split(".")[0]
                        .split(":")
                        .slice(0, 2)
                        .join(":")}
                />
                <br />
                <br />
                <label>End</label>
                <br />
                <input
                    name="end"
                    type="datetime-local"
                    defaultValue={new Date(Date.now() + 60 * 60 * 1000)
                        .toISOString()
                        .split(".")[0]
                        .split(":")
                        .slice(0, 2)
                        .join(":")}
                />
                <br />
                <br />
                <button type="submit">Create</button>
            </form>
        </div>
    );
}

export default App;
