import canister from "ic:canisters/chats";
import { fromCandid as optionFromCandid } from "../candidConverters/option";

export default async function(key: string, chunkIndex: number, chunkSize: number) : Promise<GetChunkResponse> {
    let response = await canister.get_chunk(key, chunkIndex);

    let result = optionFromCandid(response);
    if (result) {
        return {
            kind: "success",
            data: response
        };
    } else {
        return {
            kind: "notFound"
        };
    }
}

export type GetChunkResponse =
    Success |
    NotFound;

export type Success = {
    kind: "success",
    data: Uint8Array
}

export type NotFound = {
    kind: "notFound"
}
