import { UserId } from "../../domain/model/users";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(request: AddAnswerRequest) : Promise<AddAnswerResponse> {
    const client = CanisterClientFactory.current!.p2pClient;
    const candidRequest = {
        id: request.id,
        offer_id: request.offerId,
        user_id: userIdToCandid(request.userId),
        connection_string: request.connectionString,
        ice_candidates: request.iceCandidates
    };
    await client.add_answer(candidRequest);

    //TODO

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
