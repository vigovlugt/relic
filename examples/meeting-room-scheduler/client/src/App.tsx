import { useState } from "react";
import { Room } from "./views/RoomView";
import { Reservations } from "./views/ReservationsView";
import "./global.css";

function Layout({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className="h-screen flex flex-col">
            <header className="border-b border-slate-200 px-3 py-3">
                <h1 className="text-lg font-bold">Meeting Room Scheduler</h1>
            </header>
            <div className={className + " h-full"}>{children}</div>
        </div>
    );
}

function App() {
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

    if (selectedRoom) {
        return (
            <Layout>
                <Room id={selectedRoom} setSelectedRoom={setSelectedRoom} />
            </Layout>
        );
    }

    return (
        <Layout>
            <Reservations setSelectedRoom={setSelectedRoom} />
        </Layout>
    );
}

export default App;
