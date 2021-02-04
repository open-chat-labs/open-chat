import canister from "ic:canisters/p2p";
import { UserId } from "../../model/users";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(request: AddAnswerRequest) : Promise<AddAnswerResponse> {
    const candidRequest = {
        id: request.id,
        offer_id: request.offerId,
        user_id: userIdToCandid(request.userId),
        connection_string: request.connectionString,
        ice_candidates: request.iceCandidates
    };

    await canister.add_answer(candidRequest);

    return {
        kind: "success"
    };
}

export type AddAnswerRequest = {
    id: string,
    offerId: string,
    userId: UserId,
    connectionString: string,
    iceCandidates: string[]
}

export type AddAnswerResponse =
    Success;

export type Success = {
    kind: "success"
}
