import { UserId } from "../../domain/model/users";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(request: AddAnswersRequest) : Promise<void> {
    const client = CanisterClientFactory.current!.p2pClient;
    const candidRequest = {
        answers: request.answers.map(a => ({
            id: a.id,
            offer_id: a.offerId,
            user_id: userIdToCandid(a.userId),
            connection_string: a.connectionString,
            ice_candidates: a.iceCandidates
        }))
    };
    await client.add_answers(candidRequest);
}

export type AddAnswersRequest = {
    answers: AddAnswerRequest[]
}

export type AddAnswerRequest = {
    id: string,
    offerId: string,
    userId: UserId,
    connectionString: string,
    iceCandidates: string[]
}
