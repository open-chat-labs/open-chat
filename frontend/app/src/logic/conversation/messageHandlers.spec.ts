import type { ChatIdentifier, Message, MessageContent, ReplyContext } from "@client";
import type { GroupMessage } from "@openchat/ui/src/lib/types";
import { describe, expect, test, vi } from "vitest";
import {
    quoteFor,
    quoteTarget,
    retryFor,
    withHandlers,
    type MessageHandlers,
} from "./messageHandlers";
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

describe("a reply's quote, tapped", () => {
    const channel: ChatIdentifier = { kind: "channel", communityId: "c1", channelId: 9 };
    const dm: ChatIdentifier = { kind: "direct_chat", userId: "u1" };

    function reply(repliesTo: Partial<ReplyContext> & { kind: ReplyContext["kind"] }): Message {
        return {
            ...msg({ kind: "text_content", text: "yes" } as MessageContent),
            repliesTo,
        } as Message;
    }

    function quoting(chatId: ChatIdentifier, threadRootMessageIndex?: number, messageIndex = 41) {
        return reply({
            kind: "rehydrated_reply_context",
            messageIndex,
            sourceContext: { chatId, threadRootMessageIndex },
        } as Partial<ReplyContext> & { kind: "rehydrated_reply_context" });
    }

    test("goes to the quoted message in the chat, a channel's as a DM's", () => {
        expect(quoteTarget(quoting(channel), channel, "community")).toEqual({
            kind: "here",
            messageIndex: 41,
        });
        expect(quoteTarget(quoting(dm, undefined, 3), dm, "chats")).toEqual({
            kind: "here",
            messageIndex: 3,
        });
    });

    test("opens the chat or thread it's quoted from when that's elsewhere", () => {
        expect(quoteTarget(quoting(channel), dm, "chats")).toEqual({
            kind: "elsewhere",
            url: "/community/c1/channel/9/41",
        });
        expect(quoteTarget(quoting(channel, 7), channel, "community")).toEqual({
            kind: "elsewhere",
            url: "/community/c1/channel/9/7/41?open=true",
        });
    });

    test("has nowhere to go for a message that isn't a reply, or whose quote isn't loaded", () => {
        expect(
            quoteTarget(msg({ kind: "text_content", text: "hi" } as MessageContent), dm, "chats"),
        ).toBeUndefined();
        expect(quoteTarget(reply({ kind: "raw_reply_context" }), dm, "chats")).toBeUndefined();
    });

    test("is the text bubble's onQuote, none for another kind or no target", () => {
        const go = vi.fn();
        const target = { kind: "here", messageIndex: 41 } as const;
        quoteFor({ time: "", text: "yes" } as GroupMessage, target, go).onQuote?.();
        expect(go).toHaveBeenCalledWith(target);
        expect(
            quoteFor({ kind: "image", time: "", items: [] } as GroupMessage, target, go),
        ).toEqual({});
        expect(quoteFor({ time: "", text: "yes" } as GroupMessage, undefined, go)).toEqual({});
    });
});
