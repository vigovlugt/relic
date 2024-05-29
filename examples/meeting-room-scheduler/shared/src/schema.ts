import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
});

export const reservations = sqliteTable("reservations", {
    id: text("id").primaryKey(),
    roomId: text("room_id")
        .notNull()
        .references(() => rooms.id),
    owner: text("owner").notNull(),
    start: integer("start", {
        mode: "timestamp",
    }).notNull(),
    end: integer("end", {
        mode: "timestamp",
    }).notNull(),
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
};

export const drizzleSchema = {
    rooms,
    reservations,
    roomsRelations,
    reservationsRelations,
};

export const migrations = `
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    owner TEXT NOT NULL,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES meeting_rooms (id)
);
`;
