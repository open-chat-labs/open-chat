import type { ChatIdentifier, DailyResultContent } from "@client";
import { describe, expect, test, vi } from "vitest";
import { shareResultToDraft } from "./shareResult";

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

describe("sharing a result into a chat (#10236)", () => {
    test("puts the card in the chat's draft, and the message written as its text", () => {
        const drafts = { setAttachment: vi.fn(), setTextContent: vi.fn() };
        shareResultToDraft(drafts, chatId, card, "  beat that  ");
        expect(drafts.setAttachment).toHaveBeenCalledWith({ chatId }, card);
        expect(drafts.setTextContent).toHaveBeenCalledWith({ chatId }, "beat that");
    });

    test("leaves the draft's text as it was with no message", () => {
        const drafts = { setAttachment: vi.fn(), setTextContent: vi.fn() };
        shareResultToDraft(drafts, chatId, card, "   ");
        expect(drafts.setAttachment).toHaveBeenCalledWith({ chatId }, card);
        expect(drafts.setTextContent).not.toHaveBeenCalled();
    });
});
