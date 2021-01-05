import { Timestamp } from "./common";
import { UserId } from "./users";

export type Message = ConfirmedMessage | UnconfirmedMessage | MissingMessage;

export type ConfirmedMessage = {
    kind: "confirmed",
    id: number,
    timestamp: Timestamp,
    sender: UserId,
    text: string
}

export type UnconfirmedMessage = {
    kind: "unconfirmed",
    id: Symbol,
    text: string
}

export type MissingMessage = {
    kind: "missing",
    id: number
}
