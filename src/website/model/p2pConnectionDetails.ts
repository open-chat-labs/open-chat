import { UserId } from "./users";

export type p2pConnectionDetails = p2pConnectionOffer | p2pConnectionAnswer;

export type p2pConnectionOffer = {
    kind: "offer",
    id: string,
    userId: UserId,
    connectionString: string,
    ageSeconds: number
}

export type p2pConnectionAnswer = {
    kind: "answer",
    id: string,
    offerId: string,
    userId: UserId,
    connectionString: string,
    ageSeconds: number
}
