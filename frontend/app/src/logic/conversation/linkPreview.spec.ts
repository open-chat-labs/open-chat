import { i18nKey, type EventWrapper, type Message, type OgPreview } from "@client";
import { vi } from "vitest";
import { canRemovePreviews, previewLink, removeLinkPreview } from "./linkPreview";

const preview = (url: string): OgPreview => ({
    kind: "opengraph",
    url,
    title: "A",
    description: "B",
});

const msg: Pick<Message, "sender" | "content" | "ogPreviews"> = {
    sender: "me",
    content: { kind: "text_content", text: "see https://a.b" },
    ogPreviews: [preview("https://a.b")],
};

describe("a link preview's removal", () => {
    test("only the sender's own text message's previews can be taken off", () => {
        expect(canRemovePreviews(msg, "me")).toBe(true);
        expect(canRemovePreviews(msg, "them")).toBe(false);
        expect(canRemovePreviews({ ...msg, ogPreviews: [] }, "me")).toBe(false);
        expect(
            canRemovePreviews(
                { ...msg, content: { kind: "deleted_content", deletedBy: "me", timestamp: 0n } },
                "me",
            ),
        ).toBe(false);
    });

    test("a preview goes by its place in the bubble's list", () => {
        expect(previewLink(msg, 0)).toBe("https://a.b");
        expect(previewLink(msg, 1)).toBeUndefined();
    });

    test("a refusal comes back as what to say", async () => {
        const evt: EventWrapper<Message> = {
            index: 3,
            timestamp: 7n,
            event: {
                kind: "message",
                messageId: 42n,
                messageIndex: 2,
                reactions: [],
                tips: {},
                edited: false,
                forwarded: false,
                deleted: false,
                blockLevelMarkdown: false,
                messagePreviews: [],
                ...msg,
            },
        };
        const context = { chatId: { kind: "group_chat" as const, groupId: "g" } };
        const refused = { hideLinkPreview: vi.fn(async () => false) };
        expect(await removeLinkPreview(refused, context, evt, "https://a.b")).toEqual(
            i18nKey("errorRemovingLinkPreview"),
        );
        const done = { hideLinkPreview: vi.fn(async () => true) };
        expect(await removeLinkPreview(done, context, evt, "https://a.b")).toBeUndefined();
        expect(done.hideLinkPreview).toHaveBeenCalledWith(context, evt, "https://a.b");
    });
});
