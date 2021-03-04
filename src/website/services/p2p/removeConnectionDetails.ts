import { UserId } from "../../domain/model/users";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(request: RemoveConnectionDetailsRequest) : Promise<number> {
    const client = CanisterClientFactory.current!.p2pClient;
    const connections = request.connections.map(c => ({
        user_id: userIdToCandid(c.userId),
        id: c.id
    }));
    const candidRequest = {
        connections
    }

    return await client.remove_connection_details(candidRequest);
}

export type RemoveConnectionDetailsRequest = {
    connections: {
        userId: UserId,
        id: string
    }[]
}
