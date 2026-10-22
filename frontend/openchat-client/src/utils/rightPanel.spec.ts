import type { ChatEvent, EventWrapper, Message, RightPanelContent } from "@shared";
import { describe, expect, test } from "vitest";
import { rightPanelView, type RightPanelInput } from "./rightPanel";

const root: EventWrapper<ChatEvent> = {
    event: { kind: "message", messageId: 7n, messageIndex: 3 } as Message,
    timestamp: 0n,
    index: 10,
};
const thread: RightPanelContent = {
    kind: "message_thread_panel",
    threadRootMessageIndex: 3,
    threadRootMessageId: 7n,
};

function view(panel: RightPanelContent, input: Partial<RightPanelInput> = {}) {
    return rightPanelView({
        panel,
        chatKind: "group_chat",
        inCommunity: false,
        events: [],
        threadOpen: false,
        ...input,
    });
}

describe("rightPanelView", () => {
    test("invariant 1: the last history entry is read for the selected chat's kind, as the legacy RightPanel reads it", () => {
        const details: RightPanelContent = { kind: "group_details" };
        expect(view(details, { chatKind: "channel", inCommunity: true })).toEqual({
            kind: "channel_summary",
            tab: "channel",
        });
        expect(view(details).kind).toBe("group_details");
        expect(view(details, { chatKind: "direct_chat" }).kind).toBe("direct_chat_details");
        expect(
            view({ kind: "community_details" }, { chatKind: "channel", inCommunity: true }),
        ).toEqual({ kind: "channel_summary", tab: "community" });
        expect(
            view({ kind: "show_group_members" }, { chatKind: "channel", inCommunity: true }),
        ).toEqual({
            kind: "channel_or_community_members",
            tab: "channel",
        });
        expect(view({ kind: "no_panel" }).kind).toBe("none");
    });

    test("invariant 2: a thread open in the URL shows once its root message is loaded, and nothing before then", () => {
        expect(view(thread, { threadOpen: true, events: [] }).kind).toBe("none");
        expect(view(thread, { threadOpen: true, events: [root] })).toEqual({
            kind: "thread",
            rootEvent: root,
        });
        // what the history held before the thread was pushed doesn't show meanwhile
        expect(view({ kind: "group_details" }, { threadOpen: true, events: [root] }).kind).toBe(
            "none",
        );
    });

    test("invariant 3: an entry that doesn't fit the selected chat never shows", () => {
        const dm = { chatKind: "direct_chat" } as const;
        expect(view({ kind: "show_group_members" }, dm).kind).toBe("none");
        expect(view({ kind: "invite_group_users" }, dm).kind).toBe("none");
        expect(view({ kind: "show_pinned" }, dm).kind).toBe("none");
        expect(view({ kind: "show_community_members" }).kind).toBe("none");
        expect(view({ kind: "group_details" }, { chatKind: undefined }).kind).toBe("none");
    });
});
