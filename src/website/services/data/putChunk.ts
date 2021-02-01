import canister from "ic:canisters/chats";

export default async function(key: string, index: number, value: Uint8Array) : Promise<PutChunkResponse> {
    let response = await canister.put_chunk(key, index, Array.from(value));

    return {
        kind: "success"
    };
}

export type PutChunkResponse =
    Success;

export type Success = {
    kind: "success"
}
