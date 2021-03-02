import { Option } from "../../domain/model/common";
import { fromCandid as optionFromCandid } from "../candidConverters/option";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(key: string, chunkIndex: number) : Promise<GetChunkResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.get_chunk(key, chunkIndex);

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
