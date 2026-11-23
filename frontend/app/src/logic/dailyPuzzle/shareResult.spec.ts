import type { ChatIdentifier, DailyResultContent, SharedToChat } from "@client";
import { describe, expect, test, vi } from "vitest";
import { applyShared, incomingShared, sharedHere, shareStep } from "./shareResult";

const chatId: ChatIdentifier = { kind: "group_chat", groupId: "g" };
const card: DailyResultContent = {
    kind: "daily_result",
    gameId: "bridges",
    number: 12,
    userId: "me",
    solveTimeMs: 61_000,
    hintsUsed: 0,
    streak: 1,
    layout: "",
};
const shared = (text = ""): SharedToChat => ({ chatId, attachment: card, text });

describe("a share waiting for a chat (#10236)", () => {
    test("is taken by that chat's conversation, open already or opening", () => {
        expect(sharedHere(shared(), { kind: "group_chat", groupId: "g" }, false)).toBe(true);
    });

    test("isn't taken by another chat, by a thread, or when there's none", () => {
        expect(sharedHere(shared(), { kind: "group_chat", groupId: "h" }, false)).toBe(false);
        expect(sharedHere(shared(), chatId, true)).toBe(false);
        expect(sharedHere(undefined, chatId, false)).toBe(false);
    });
});

describe("taking a shared result into the draft (the user's decision of 2026-11-23)", () => {
    test("asks first in place of a staged transfer, prize or swap offer", () => {
        for (const [kind, staged] of [
            ["crypto_content", "transfer"],
            ["prize_content_initial", "prize"],
            ["p2p_swap_content_initial", "swap"],
        ] as const) {
            expect(shareStep({ kind }, shared())).toEqual({
                kind: "confirm",
                question: { staged, incoming: "result" },
            });
        }
    });

    test("attaches at once over nothing, or over a photo, file or GIF", () => {
        expect(shareStep(undefined, shared())).toEqual({ kind: "attach" });
        expect(shareStep({ kind: "image_content" }, shared())).toEqual({ kind: "attach" });
        expect(shareStep({ kind: "giphy_content" }, shared())).toEqual({ kind: "attach" });
    });

    test("words a result as a result, and anything else as the composer does", () => {
        expect(incomingShared(card)).toBe("result");
        expect(incomingShared({ kind: "image_content" })).toBe("photo");
    });

    test("puts the card in the draft, and the message written as its text", () => {
        const drafts = { setAttachment: vi.fn(), setTextContent: vi.fn() };
        expect(applyShared(drafts, { chatId }, shared("  beat that  "))).toBe(true);
        expect(drafts.setAttachment).toHaveBeenCalledWith({ chatId }, card);
        expect(drafts.setTextContent).toHaveBeenCalledWith({ chatId }, "beat that");
    });

    test("leaves the draft's text as it was with no message", () => {
        const drafts = { setAttachment: vi.fn(), setTextContent: vi.fn() };
        expect(applyShared(drafts, { chatId }, shared("   "))).toBe(false);
        expect(drafts.setAttachment).toHaveBeenCalledWith({ chatId }, card);
        expect(drafts.setTextContent).not.toHaveBeenCalled();
    });
});
