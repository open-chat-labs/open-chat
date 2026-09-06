import { Actor, HttpAgent } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import type { MessageContent } from "@shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageBucketClient } from "../../../openchat-agent/src/services/storageBucket/storageBucket.client";
import {
    MAX_PUBLIC_AUDIO_BYTES,
    MAX_PUBLIC_IMAGE_BYTES,
    publicBlobIdlFactory,
    type PublicBlobHttpRequest,
    type PublicBlobHttpResponse,
} from "../../../openchat-agent/src/services/storageBucket/publicBlob";
import { localAudioInput } from "./localAudioInput";

afterEach(() => vi.restoreAllMocks());

const WEBM_BYTES = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
]);

function rangeQuery(bytes: Uint8Array, mimeType: string) {
    return vi.fn(async (request: PublicBlobHttpRequest): Promise<PublicBlobHttpResponse> => {
        const match = /^bytes=(\d+)-(\d+)$/.exec(request.headers[0][1]);
        expect(match).not.toBeNull();
        const start = Number(match![1]);
        const body = bytes.slice(start, Number(match![2]));
        return {
            status_code: 206,
            body,
            upgrade: [],
            headers: [
                ["Content-Type", mimeType],
                ["Content-Length", String(body.length)],
                ["Content-Range", `bytes ${start}-${start + body.length - 1}/${bytes.length}`],
            ],
        };
    });
}

function publicStorageClient(
    query: (request: PublicBlobHttpRequest) => Promise<PublicBlobHttpResponse>,
) {
    const identity = Ed25519KeyIdentity.generate(new Uint8Array(32).fill(7));
    const source = HttpAgent.createSync({
        host: "http://127.0.0.1:4943",
        identity,
        verifyQuerySignatures: false,
    });
    let anonymousAgent: HttpAgent | undefined;
    vi.spyOn(Actor, "createActor").mockImplementation((factory, options) => {
        if (factory === publicBlobIdlFactory) {
            anonymousAgent = options.agent as HttpAgent;
            return { http_request: query } as never;
        }
        return {} as never;
    });
    const client = new StorageBucketClient(identity, source, "ucwa4-rx777-77774-qaada-cai");
    return { client, anonymousAgent, source };
}

describe("referenced local voice transport", () => {
    it("routes a real referenced voice reader through the actual anonymous storage method above 5 MiB", async () => {
        const bytes = new Uint8Array(MAX_PUBLIC_IMAGE_BYTES + 1);
        bytes.set(WEBM_BYTES);
        const query = rangeQuery(bytes, "audio/webm;codecs=opus");
        const { client, anonymousAgent, source } = publicStorageClient(query);
        const ref = { canisterId: "ucwa4-rx777-77774-qaada-cai", blobId: 55n };
        const voice = {
            kind: "audio_content",
            caption: "voice note",
            mimeType: "audio/webm;codecs=opus",
            samples: new Uint8Array(),
            durationMs: 2000n,
            blobReference: ref,
            blobUrl: `http://${ref.canisterId}.raw.localhost:8080/blobs/55`,
        } as MessageContent;
        const directFetch = vi.spyOn(globalThis, "fetch");
        const result = await localAudioInput(
            voice,
            (reference, cap) => client.downloadPublicBlob(reference.blobId, cap, "audio"),
            { protocol: "https:", hostname: "chat.example" },
            "http://{canisterId}.raw.localhost:8080/{blobType}",
        );
        expect(result?.audioMimeType).toBe("audio/webm;codecs=opus");
        expect(result?.audio).toHaveLength(bytes.length);
        expect(Buffer.compare(Buffer.from(result!.audio), Buffer.from(bytes))).toBe(0);
        expect(directFetch).not.toHaveBeenCalled();
        expect(query).toHaveBeenCalledTimes(4);
        expect((await anonymousAgent!.getPrincipal()).toText()).toBe("2vxsx-fae");
        expect((await source.getPrincipal()).toText()).not.toBe("2vxsx-fae");
        await expect(
            client.downloadPublicBlob(55n, MAX_PUBLIC_AUDIO_BYTES),
        ).resolves.toBeUndefined();
        expect(query).toHaveBeenCalledTimes(4);
    });
});
