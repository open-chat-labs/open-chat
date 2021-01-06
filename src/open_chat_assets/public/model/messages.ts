import { Timestamp } from "./common";
import { UserId } from "./users";

export type Message = LocalMessage | RemoteMessage | UnconfirmedMessage;

export type LocalMessage = {
    kind: "local",
    id: number,
    timestamp: Timestamp,
    sender: UserId,
    text: string
}

export type RemoteMessage = {
    kind: "remote",
    id: number
}

export type UnconfirmedMessage = {
    kind: "unconfirmed",
    id: Symbol,
    text: string
}
