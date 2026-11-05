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

import type { AttachmentContent, MessageContext } from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { localUpdates } from "./state";

// A file the user picks, drops or pastes becomes the attachment of the draft it was picked for.

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

const picked: MessageContext = { chatId: { kind: "group_chat", groupId: "picked" } };
const other: MessageContext = { chatId: { kind: "group_chat", groupId: "other" } };
const thread: MessageContext = { ...picked, threadRootMessageIndex: 4 };

const video: AttachmentContent = {
    kind: "video_content",
    height: 1,
    width: 1,
    thumbnailData: "",
    mimeType: "video/mp4",
    imageData: {},
    videoData: { blobUrl: "blob:v" },
};

const file = new File(["x"], "clip.mp4", { type: "video/mp4" });

describe("attaching a file", () => {
    let client: OpenChat;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        client = new OpenChat(config());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        [picked, other, thread].forEach((c) => localUpdates.draftMessages.delete(c));
    });

    /** 5c invariant 1: the file goes to the chat it was picked in, even when it takes a while to
     * prepare, and only where its kind may be sent. */
    test("goes to the draft it was picked for, once ready", async () => {
        let ready: (content: AttachmentContent) => void = () => {};
        vi.spyOn(client, "messageContentFromFile").mockReturnValue(
            new Promise((resolve) => (ready = resolve)),
        );
        const canSend = vi.spyOn(client, "canSendMessage").mockReturnValue(true);

        const attaching = client.attachFile(file, picked);
        // meanwhile the user writes in another chat
        localUpdates.draftMessages.setTextContent(other, "elsewhere");
        ready(video);

        expect(await attaching).toEqual({ kind: "attached" });
        expect(localUpdates.draftMessages.value.get(picked)?.attachment).toBe(video);
        expect(localUpdates.draftMessages.value.get(other)?.attachment).toBeUndefined();
        expect(canSend).toHaveBeenCalledWith(picked.chatId, "message", "video");
    });

    test("is refused, naming the permission, where its kind may not be sent", async () => {
        vi.spyOn(client, "messageContentFromFile").mockResolvedValue(video);
        const canSend = vi.spyOn(client, "canSendMessage").mockReturnValue(false);

        expect(await client.attachFile(file, thread)).toEqual({
            kind: "not_permitted",
            permission: "video",
        });
        expect(canSend).toHaveBeenCalledWith(picked.chatId, "thread", "video");
        expect(localUpdates.draftMessages.value.get(thread)?.attachment).toBeUndefined();
    });

    test("fails with the reason when the file can't be prepared", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(client, "messageContentFromFile").mockRejectedValue("maxVideoSize");

        const outcome = await client.attachFile(file, picked);

        expect(outcome).toMatchObject({ kind: "failed", message: { key: "maxVideoSize" } });
        expect(localUpdates.draftMessages.value.get(picked)?.attachment).toBeUndefined();
    });
});
