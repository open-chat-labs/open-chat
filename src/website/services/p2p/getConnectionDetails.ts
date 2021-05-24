import { Option, Timestamp } from "../../domain/model/common";
import { P2PConnectionDetails } from "../../domain/model/p2pConnectionDetails";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { fromCandid as connectionDetailsFromCandid } from "../candidConverters/p2pConnectionDetails";
import { fromCandid as timestampFromCandid, toCandid as timestampToCandid } from "../candidConverters/timestamp";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(updatedSince: Option<Timestamp>) : Promise<GetConnectionDetailsResponse> {
    const client = CanisterClientFactory.current!.p2pClient;
    const candidRequest = optionToCandid(updatedSince ? timestampToCandid(updatedSince) : null);
    const response = await client.get_connection_details(candidRequest);

    if ("Success" in response) {
        const connections = response.Success.connections.map(connectionDetailsFromCandid);
        return {
            kind: "success",
            connections,
            timestamp: timestampFromCandid(response.Success.timestamp)
        }
    } else {
        throw new Error("Unrecognised 'get_connection_details' response");
    }
}

export type GetConnectionDetailsResponse = GetConnectionDetailsResult;

export type GetConnectionDetailsResult = {
    kind: "success",
    connections: P2PConnectionDetails[],
    timestamp: Timestamp
}
