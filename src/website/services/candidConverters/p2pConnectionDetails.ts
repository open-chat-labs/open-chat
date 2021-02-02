import { p2pConnectionDetails } from "../../model/p2pConnectionDetails";
import { fromCandid as userIdFromCandid } from "../candidConverters/userId";

export function fromCandid(connectionDetails: any) : p2pConnectionDetails {
    if (connectionDetails.hasOwnProperty("Offer")) {
        const offer = connectionDetails.Offer;
        return {
            kind: "offer",
            id: offer.id,
            userId: userIdFromCandid(offer.user_id),
            connectionString: offer.connection_string,
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
            ageSeconds: answer.age_seconds
        };
    } else {
        throw new Error("Unrecognised connection details type");
    }
}