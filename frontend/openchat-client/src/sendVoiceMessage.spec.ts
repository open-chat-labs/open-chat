import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

// The constructor starts an auth client against IndexedDB; keep it inert
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: () => new Promise(() => {}) },
}));

// jsdom has no AudioContext to work the waveform out with
vi.mock("./utils/media", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    audioContent: vi.fn(),
}));

import type { AudioContent, MessageContext } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { audioContent } from "./utils/media";

// A voice message recorded in the composer goes out as the audio content of a message.

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
    } as unknown as OpenChatConfig;
}

const context: MessageContext = { chatId: { kind: "group_chat", groupId: "g" } };

const voice: AudioContent = {
    kind: "audio_content",
    mimeType: "audio/mp4",
    samples: new Uint8Array([1, 2]),
    durationMs: 1500n,
    blobUrl: "blob:a",
};

describe("sending a voice message", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    test("sends the recording as the message's audio, with no text", async () => {
        vi.mocked(audioContent).mockResolvedValue(voice);
        const send = vi.spyOn(client, "sendMessage").mockResolvedValue({ kind: "posted" });
        const bytes = new ArrayBuffer(4);

        expect(await client.sendVoiceMessage(context, bytes, "audio/mp4")).toEqual({
            kind: "posted",
        });
        expect(audioContent).toHaveBeenCalledWith(bytes, "audio/mp4");
        expect(send).toHaveBeenCalledWith(context, undefined, false, voice);
    });

    test("fails, sending nothing, when the recording can't be read as audio", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.mocked(audioContent).mockRejectedValue(new Error("unable to decode"));
        const send = vi.spyOn(client, "sendMessage");

        expect(await client.sendVoiceMessage(context, new ArrayBuffer(4), "audio/mp4")).toEqual({
            kind: "failed",
        });
        expect(send).not.toHaveBeenCalled();
    });
});
