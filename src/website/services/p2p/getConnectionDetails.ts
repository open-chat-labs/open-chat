import canister from "ic:canisters/p2p";
import { Option, Timestamp } from "../../model/common";
import { P2PConnectionDetails } from "../../model/p2pConnectionDetails";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { fromCandid as connectionDetailsFromCandid } from "../candidConverters/p2pConnectionDetails";
import { fromCandid as timestampFromCandid, toCandid as timestampToCandid } from "../candidConverters/timestamp";

export default async function(updatedSince: Option<Timestamp>) : Promise<GetConnectionDetailsResponse> {
    const candidRequest = optionToCandid(updatedSince ? timestampToCandid(updatedSince) : null);

    const response = await canister.get_connection_details(candidRequest);

    if (response.hasOwnProperty("Success")) {
        const connections = response.Success.connections.map(connectionDetailsFromCandid);
        return {
            kind: "success",
            connections,
            timestamp: timestampFromCandid(response.Success.timestamp)
        }
    } else {
        throw new Error("Unrecognised 'add_offer' response");
    }
}

export type GetConnectionDetailsResponse = GetConnectionDetailsResult;

export type GetConnectionDetailsResult = {
    kind: "success",
    connections: P2PConnectionDetails[],
    timestamp: Timestamp
}
