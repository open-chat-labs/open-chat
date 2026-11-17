import type { ChatIdentifier } from "@client";
import { describe, expect, test, vi } from "vitest";
import { ringActions } from "./incomingCall";

const chatId: ChatIdentifier = { kind: "direct_chat", userId: "them" };

function handlers() {
    return { clear: vi.fn(), decline: vi.fn(), open: vi.fn(), join: vi.fn() };
}

describe("answering an incoming call", () => {
    // Accept joins the call ringing, as the type it was started as. Starting a call instead
    // would make a second call beside the one ringing.
    test("Accept opens the chat and joins the call as its type", () => {
        const h = handlers();
        ringActions({ chatId, callType: "audio" }, h).accept();

        expect(h.open).toHaveBeenCalledWith(chatId);
        expect(h.join).toHaveBeenCalledWith({ chatId, callType: "audio", join: true });
        expect(h.clear).toHaveBeenCalled();
        expect(h.decline).not.toHaveBeenCalled();
    });

    // Declining a direct call ends it for the caller, so only the Decline button may do it.
    // Hiding the card (✕, Esc, or the card going away) leaves the call ringing elsewhere.
    test("only Decline declines; dismissing stops the ring here and nothing more", () => {
        const dismissed = handlers();
        ringActions({ chatId, callType: "default" }, dismissed).dismiss();
        expect(dismissed.clear).toHaveBeenCalled();
        expect(dismissed.decline).not.toHaveBeenCalled();
        expect(dismissed.join).not.toHaveBeenCalled();

        const declined = handlers();
        ringActions({ chatId, callType: "default" }, declined).decline();
        expect(declined.decline).toHaveBeenCalledWith(chatId);
        expect(declined.clear).toHaveBeenCalled();
    });
});
