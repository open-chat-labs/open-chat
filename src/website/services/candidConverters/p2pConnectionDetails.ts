import { P2PConnectionDetails } from "../../domain/model/p2pConnectionDetails";
import { fromCandid as userIdFromCandid } from "../candidConverters/userId";

export function fromCandid(connectionDetails: any) : P2PConnectionDetails {
    if (connectionDetails.hasOwnProperty("Offer")) {
        const offer = connectionDetails.Offer;
        return {
            kind: "offer",
            id: offer.id,
            userId: userIdFromCandid(offer.user_id),
            connectionString: offer.connection_string,
            iceCandidates: offer.ice_candidates,
            ageSeconds: offer.age_seconds
        };
    } else if (connectionDetails.hasOwnProperty("Answer")) {
        const answer = connectionDetails.Answer;
        return {
            kind: "answer",
            id: answer.id,
            offerId: answer.offer_id,
            userId: userIdFromCandid(answer.user_id),
            connectionString: answer.connection_string,
            iceCandidates: answer.ice_candidates,
            ageSeconds: answer.age_seconds
        };
    } else {
        throw new Error("Unrecognised connection details type");
    }
}