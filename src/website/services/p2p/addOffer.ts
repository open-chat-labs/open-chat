import { Option } from "../../domain/model/common";
import { P2PConnectionOffer } from "../../domain/model/p2pConnectionDetails";
import { UserId } from "../../domain/model/users";
import { fromCandid as optionFromCandid } from "../candidConverters/option";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(request: AddOfferRequest) : Promise<AddOfferResponse> {
    const client = CanisterClientFactory.current!.p2pClient;
    const canisterRequest = {
        id: request.id,
        user_id: userIdToCandid(request.userId),
        connection_string: request.connectionString,
        ice_candidates: request.iceCandidates
    };
    const response = await client.add_offer(canisterRequest);

    if (response.hasOwnProperty("Success")) {
        const result = response.Success;
        const candidCounterOffer: any = optionFromCandid(result.existing_counter_offer);
        const counterOffer: Option<P2PConnectionOffer> = candidCounterOffer
            ? {
                kind: "offer",
                id: candidCounterOffer.id,
                userId: request.userId,
                connectionString: candidCounterOffer.connection_string,
                iceCandidates: candidCounterOffer.ice_candidates,
                ageSeconds: candidCounterOffer.age_seconds
            }
            : null;

        return {
            kind: "success",
            offerAdded: result.offer_added,
            existingCounterOffer: counterOffer
        };
    } else {
        throw new Error("Unrecognised 'add_offer' response");
    }
}

export type AddOfferRequest = {
    id: string,
    userId: UserId,
    connectionString: string,
    iceCandidates: string[]
}

export type AddOfferResponse =
    Success;

export type Success = {
    kind: "success",
    offerAdded: boolean,
    existingCounterOffer: Option<P2PConnectionOffer>
}
