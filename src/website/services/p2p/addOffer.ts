import canister from "ic:canisters/p2p";
import { Option } from "../../model/common";
import { p2pConnectionOffer } from "../../model/p2pConnectionDetails";
import { UserId } from "../../model/users";
import { fromCandid as optionFromCandid } from "../candidConverters/option";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(request: AddOfferRequest) : Promise<AddOfferResponse> {
    const canisterRequest = {
        id: request.id,
        user_id: userIdToCandid(request.userId),
        connection_string: request.connectionString
    };

    const response = await canister.add_offer(canisterRequest);

    if (response.hasOwnProperty("Success")) {
        const result = response.Success;
        const candidCounterOffer: any = optionFromCandid(result.existing_counter_offer);
        const counterOffer: Option<p2pConnectionOffer> = candidCounterOffer
            ? {
                kind: "offer",
                id: candidCounterOffer.id,
                userId: request.userId,
                connectionString: candidCounterOffer.connection_string,
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
    connectionString: string
}

export type AddOfferResponse =
    Success;

export type Success = {
    kind: "success",
    offerAdded: boolean,
    existingCounterOffer: Option<p2pConnectionOffer>
}
