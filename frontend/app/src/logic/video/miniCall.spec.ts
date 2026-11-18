import type { ChatIdentifier } from "@client";
import { describe, expect, test, vi } from "vitest";
import { backToCall, miniCallShows } from "./miniCall";

const callChat: ChatIdentifier = { kind: "group_chat", groupId: "call-group" };
const otherChat: ChatIdentifier = { kind: "direct_chat", userId: "someone" };

describe("the minimised call", () => {
    test("invariant 2: shows exactly when there's a call that's minimised or not in the selected chat", () => {
        expect(miniCallShows(undefined, callChat)).toBe(false);
        expect(miniCallShows({ chatId: callChat, view: "default" }, callChat)).toBe(false);
        expect(miniCallShows({ chatId: callChat, view: "minimised" }, callChat)).toBe(true);
        expect(miniCallShows({ chatId: callChat, view: "default" }, otherChat)).toBe(true);
        expect(miniCallShows({ chatId: callChat, view: "default" }, undefined)).toBe(true);
    });

    test("invariant 3: Back to call opens the call's chat and shows the call", () => {
        const setView = vi.fn();
        expect(backToCall({ chatId: callChat, view: "minimised" }, otherChat, setView)).toBe(
            "/chats/group/call-group",
        );
        expect(setView).toHaveBeenCalledWith("default");

        // already in the call's chat: nothing to open, the call comes back over its messages
        const here = vi.fn();
        expect(backToCall({ chatId: callChat, view: "minimised" }, callChat, here)).toBeUndefined();
        expect(here).toHaveBeenCalledWith("default");
    });
});
