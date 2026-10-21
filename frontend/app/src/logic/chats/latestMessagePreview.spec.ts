import type { ChatSummary, MessageContent } from "@client";
import { describe, expect, test } from "vitest";
import { latestMessagePreview, type PreviewText } from "./latestMessagePreview";

const membership = { role: 1, archived: false, notificationsMuted: false };

function chat(
    kind: "direct_chat" | "group_chat",
    latest: { sender: string; text: string; flags?: number; webhook?: boolean } | undefined,
    extra: Partial<ChatSummary> = {},
): ChatSummary {
    return {
        kind,
        id: kind === "direct_chat" ? { kind, userId: "alice" } : { kind, groupId: "g1" },
        them: { kind: "direct_chat", userId: "alice" },
        latestMessageIndex: latest === undefined ? undefined : 3,
        eventsTtlLastUpdated: 0n,
        membership,
        latestMessage: latest && {
            timestamp: 5n,
            event: {
                messageId: 9n,
                sender: latest.sender,
                content: { kind: "text_content", text: latest.text },
                moderationFlags: latest.flags,
                senderContext: latest.webhook ? { kind: "webhook" } : undefined,
            },
        },
        ...extra,
    } as unknown as ChatSummary;
}

const text: PreviewText = {
    formatter: (key, options) =>
        options?.values ? `${key}(${JSON.stringify(options.values)})` : key,
    me: "me",
    displayName: (id, kind) => (kind === "me" ? "You" : kind === "webhook" ? "Webhook" : id),
    translations: new Map([[9n, "bonjour"]]),
    contentText: (content: MessageContent) =>
        content.kind === "text_content" ? content.text : content.kind,
};
const untranslated = { ...text, translations: new Map<bigint, string>() };

/** Invariant: a chat's preview line is the same in every tree (the old rows' formatLatestMessage). */
describe("a chat's latest message preview", () => {
    test("is the text in a DM, and after its sender (you, a webhook, the user) in a group", () => {
        expect(
            latestMessagePreview(
                chat("direct_chat", { sender: "alice", text: "hi" }),
                untranslated,
            ),
        ).toBe("hi");
        expect(
            latestMessagePreview(chat("group_chat", { sender: "bob", text: "hi" }), untranslated),
        ).toBe("bob: hi");
        expect(
            latestMessagePreview(chat("group_chat", { sender: "me", text: "hi" }), untranslated),
        ).toBe("You: hi");
        expect(
            latestMessagePreview(
                chat("group_chat", { sender: "x", text: "hi", webhook: true }),
                untranslated,
            ),
        ).toBe("Webhook: hi");
    });

    test("shows the reader's translation", () => {
        expect(
            latestMessagePreview(chat("direct_chat", { sender: "alice", text: "hello" }), text),
        ).toBe("bonjour");
    });

    test("says disappearing messages changed, and is empty once the message has gone", () => {
        const changed = chat("group_chat", { sender: "bob", text: "hi" }, {
            eventsTTL: 3_600_000n,
            eventsTtlLastUpdated: 6n,
        } as Partial<ChatSummary>);
        expect(latestMessagePreview(changed, untranslated)).toMatch(
            /^disappearingMessages\.timeUpdated/,
        );
        const gone = chat("direct_chat", { sender: "alice", text: "secret" });
        (gone.latestMessage as { expiresAt?: number }).expiresAt = 1_000;
        expect(latestMessagePreview(gone, untranslated, 2_000)).toBe("");
    });
});
