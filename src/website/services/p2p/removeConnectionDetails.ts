import canister from "ic:canisters/p2p";
import { UserId } from "../../domain/model/users";
import { toCandid as userIdToCandid } from "../candidConverters/userId";

export default async function(request: RemoveConnectionDetailsRequest) : Promise<number> {
    const connections = request.connections.map(c => ({
        user_id: userIdToCandid(c.userId),
        id: c.id
    }));

    const candidRequest = {
        connections
    }

    return await canister.remove_connection_details(candidRequest);
}

export type RemoveConnectionDetailsRequest = {
    connections: {
        userId: UserId,
        id: string
    }[]
}
