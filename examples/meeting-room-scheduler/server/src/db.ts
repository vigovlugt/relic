import { relations, sql } from "drizzle-orm";
import {
    pgTable,
    text,
    integer,
    timestamp,
    uuid,
    json,
} from "drizzle-orm/pg-core";

export const clients = pgTable("relic_clients", {
    id: uuid("id").primaryKey(),
    mutationId: integer("mutation_id").notNull(),
});

export const clientViews = pgTable("relic_client_views", {
    id: uuid("id").primaryKey(),
    createdAt: timestamp("created_at"),
    data: json("data").notNull(),
});

const version = () =>
    integer("version")
        .notNull()
        .$defaultFn(() => 0)
        .$onUpdateFn(() => sql`version + 1`);

export const rooms = pgTable("rooms", {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    version: version(),
});

export const reservations = pgTable("reservations", {
    id: uuid("id").primaryKey(),
    roomId: uuid("room_id")
        .notNull()
        .references(() => rooms.id),
    owner: text("owner").notNull(),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
    version: version(),
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

export const drizzleSchema = {
    rooms,
    reservations,
    roomsRelations,
    reservationsRelations,
};

export const migrations = `
CREATE TABLE IF NOT EXISTS relic_clients (
    id UUID PRIMARY KEY,
    mutation_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS relic_client_views (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP,
    data JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    owner TEXT NOT NULL,
    start TIMESTAMP NOT NULL,
    "end" TIMESTAMP NOT NULL,
    version INTEGER NOT NULL DEFAULT 0
);

INSERT INTO rooms (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Room 1') ON CONFLICT DO NOTHING;
INSERT INTO rooms (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Room 2') ON CONFLICT DO NOTHING;
INSERT INTO rooms (id, name) VALUES ('00000000-0000-0000-0000-000000000002', 'Room 3') ON CONFLICT DO NOTHING;
`;
