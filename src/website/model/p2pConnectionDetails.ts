import { UserId } from "./users";

export type P2PConnectionDetails = P2PConnectionOffer | P2PConnectionAnswer;

export type P2PConnectionOffer = {
    kind: "offer",
    id: string,
    userId: UserId,
    connectionString: string,
    iceCandidates: string[],
    ageSeconds: number
}

export type P2PConnectionAnswer = {
    kind: "answer",
    id: string,
    offerId: string,
    userId: UserId,
    connectionString: string,
    iceCandidates: string[],
    ageSeconds: number
}
