import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
});

export const reservations = pgTable("reservations", {
    id: uuid("id").primaryKey(),
    roomId: uuid("room_id")
        .notNull()
        .references(() => rooms.id),
    owner: text("owner").notNull(),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
});

export const roomsRelations = relations(rooms, ({ many }) => ({
    reservations: many(reservations),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
    room: one(rooms, {
        fields: [reservations.roomId],
        references: [rooms.id],
    }),
}));

export const schema = {
    rooms,
    reservations,
    roomsRelations,
    reservationsRelations,
};

export const migrations = `
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    owner TEXT NOT NULL,
    start TIMESTAMP NOT NULL,
    "end" TIMESTAMP NOT NULL
);

INSERT INTO rooms (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Room 1') ON CONFLICT DO NOTHING;
INSERT INTO rooms (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Room 2') ON CONFLICT DO NOTHING;
INSERT INTO rooms (id, name) VALUES ('00000000-0000-0000-0000-000000000002', 'Room 3') ON CONFLICT DO NOTHING;
`;
