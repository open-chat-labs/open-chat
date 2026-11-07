import type { Message, MessageContent } from "@client";
import type { GroupMessage } from "@openchat/ui/src/lib/types";
import { describe, expect, test, vi } from "vitest";
import { retryFor, withHandlers, type MessageHandlers } from "./messageHandlers";
import type { MessageRow } from "./messageRow";
import type { VoicePlayer } from "./voicePlayer.svelte";

function msg(content: MessageContent): Message {
    return { messageId: 1n, messageIndex: 0, sender: "alice", content } as Message;
}

function row(message: GroupMessage): MessageRow {
    return { side: "received", senderName: "Alice", color: "violet", message };
}

function handlers(fields: Partial<MessageHandlers> = {}): MessageHandlers {
    return {
        openMedia: vi.fn(),
        openUrl: vi.fn(),
        claim: vi.fn(),
        vote: vi.fn(),
        download: vi.fn(),
        voice: {} as VoicePlayer,
        ...fields,
    };
}

describe("a message's controls", () => {
    test("a photo opens in the viewer", () => {
        const h = handlers();
        const m = msg({
            kind: "image_content",
            width: 1,
            height: 1,
            thumbnailData: "",
        } as MessageContent);
        const shown = withHandlers(row({ kind: "image", time: "", items: [] }), m, h, new Map());
        (shown as { onOpen: () => void }).onOpen();
        expect(h.openMedia).toHaveBeenCalledWith(m);
    });

    test("a poll's vote and a file's download go to the conversation", () => {
        const h = handlers();
        const content = { kind: "poll_content" } as MessageContent;
        const voted = withHandlers(
            row({ kind: "poll", time: "" } as GroupMessage),
            msg(content),
            h,
            new Map(),
        );
        (voted as { onVote: (next: number[]) => void }).onVote([1]);
        expect(h.vote).toHaveBeenCalledWith(expect.anything(), content, [1]);

        const file = { kind: "file_content", name: "a.txt" } as MessageContent;
        const shown = withHandlers(
            row({ kind: "file", time: "" } as GroupMessage),
            msg(file),
            h,
            new Map(),
        );
        (shown as { onDownload: () => void }).onDownload();
        expect(h.download).toHaveBeenCalledWith(file);
    });

    test("a swap offer has no button where the conversation takes no swaps", () => {
        const content = { kind: "p2p_swap_content" } as MessageContent;
        const base = { kind: "swap", time: "", canAct: true } as GroupMessage;
        const without = withHandlers(row(base), msg(content), handlers(), new Map());
        expect((without as { canAct: boolean }).canAct).toBe(false);
        const swap = vi.fn();
        const shown = withHandlers(row(base), msg(content), handlers({ swap }), new Map());
        expect((shown as { canAct: boolean }).canAct).toBe(true);
        (shown as { onAccept: () => void }).onAccept();
        expect(swap).toHaveBeenCalledWith(expect.anything(), content, "accept");
    });

    test("a text message is shown as it is", () => {
        const message = { kind: "text", text: "hi", time: "" } as GroupMessage;
        const shown = withHandlers(
            row(message),
            msg({ kind: "text_content", text: "hi" }),
            handlers(),
            new Map(),
        );
        expect(shown).toBe(message);
    });
});

describe("a failed message's Retry", () => {
    test("is a text bubble's line, a file or media tile's button, and nothing else's", () => {
        const retry = () => undefined;
        expect(retryFor({ kind: "text", text: "", time: "" } as GroupMessage, retry)).toEqual({
            retryAction: retry,
        });
        expect(retryFor({ kind: "file", time: "" } as GroupMessage, retry)).toEqual({
            onRetry: retry,
        });
        expect(retryFor({ kind: "poll", time: "" } as GroupMessage, retry)).toEqual({});
        expect(retryFor({ kind: "text", text: "", time: "" } as GroupMessage, undefined)).toEqual(
            {},
        );
    });
});
