import { Timestamp } from "./common";
import { UserId } from "./users";

export type Message = ConfirmedMessage | UnconfirmedMessage;

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
