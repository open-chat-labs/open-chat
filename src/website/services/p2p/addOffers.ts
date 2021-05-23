import { P2PConnectionOffer } from "../../domain/model/p2pConnectionDetails";
import { UserId } from "../../domain/model/users";
import { fromCandid as userIdFromCandid, toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(request: AddOffersRequest) : Promise<AddOffersResponse> {
    const client = CanisterClientFactory.current!.p2pClient;
    const canisterRequest = {
        offers: request.offers.map(o => ({
            id: o.id,
            user_id: userIdToCandid(o.userId),
            connection_string: o.connectionString,
            ice_candidates: o.iceCandidates
        }))
    };
    const response = await client.add_offers(canisterRequest);

    if ("Success" in response) {
        const result = response.Success;
        const counterOffers: P2PConnectionOffer[] = result.counter_offers.map(o => ({
            kind: "offer",
            id: o.id,
            userId: userIdFromCandid(o.user_id),
            connectionString: o.connection_string,
            iceCandidates: o.ice_candidates,
            ageSeconds: o.age_seconds
        }));

        return {
            kind: "success",
            counterOffers
        };
    } else {
        throw new Error("Unrecognised 'add_offer' response");
    }
}

export type AddOffersRequest = {
    offers: AddOfferRequest[]
}

export type AddOfferRequest = {
    id: string,
    userId: UserId,
    connectionString: string,
    iceCandidates: string[]
}

export type AddOffersResponse =
    Success;

export type Success = {
    kind: "success",
    counterOffers: P2PConnectionOffer[]
}
