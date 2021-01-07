import { Timestamp } from "./common";
import { UserId } from "./users";

export type Message = LocalMessage | RemoteMessage | UnconfirmedMessage;

export type LocalMessage = ConfirmedMessage & {
    kind: "local",
    timestamp: Timestamp,
    sender: UserId,
    text: string
}

export type RemoteMessage = ConfirmedMessage & {
    kind: "remote"
}

export type ConfirmedMessage = {
    id: number
}

export type UnconfirmedMessage = {
    kind: "unconfirmed",
    id: Symbol,
    timestamp: Timestamp,
    text: string
}
