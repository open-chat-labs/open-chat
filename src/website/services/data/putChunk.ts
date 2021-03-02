import CanisterClientFactory from "../CanisterClientFactory";

export default async function(key: string, index: number, value: Uint8Array) : Promise<PutChunkResponse> {
    const client = CanisterClientFactory.current!.chatsClient;
    const response = await client.put_chunk(key, index, Array.from(value));

    //TODO

    return {
        kind: "success"
    };
}

export type PutChunkResponse =
    Success;

export type Success = {
    kind: "success"
}
