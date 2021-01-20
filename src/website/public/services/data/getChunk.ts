import canister from "ic:canisters/chats";
import { Option } from "../../model/common";
import { fromCandid as optionFromCandid } from "../candidConverters/option";

export default async function(key: string, chunkIndex: number, chunkSize: number) : Promise<GetChunkResponse> {
    const response = await canister.get_chunk(key, chunkIndex);

    const result: Option<number[]> = optionFromCandid(response);
    if (result) {
        return {
            kind: "success",
            data: new Uint8Array(result)
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
