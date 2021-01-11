import { UserId } from "./users";

export type Message = ConfirmedMessage | UnconfirmedMessage;

export type ConfirmedMessage = LocalMessage | RemoteMessage;

export type LocalMessage = {
    kind: "local",
    id: number,
    date: Date,
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
