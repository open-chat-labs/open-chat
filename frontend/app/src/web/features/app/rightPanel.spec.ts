import type { RightPanelContent } from "@client";
import { describe, expect, test } from "vitest";
import { historyWith, rightColumnPanel } from "./rightPanel";

const thread: RightPanelContent = {
    kind: "message_thread_panel",
    threadRootMessageIndex: 3,
    threadRootMessageId: 7n,
};

describe("rightColumnPanel", () => {
    test("invariant 2: with a thread open in the URL, the column shows that thread and nothing before then", () => {
        expect(rightColumnPanel(thread, true)).toBe(thread);
        // neither what the history held before the thread nor the chat's details show meanwhile
        expect(rightColumnPanel({ kind: "group_details" }, true).kind).toBe("no_panel");
        expect(rightColumnPanel({ kind: "no_panel" }, true).kind).toBe("no_panel");
    });
});

describe("historyWith", () => {
    // closing a panel opened from the chat's default details goes back to them, not out of the column
    test("puts the default details under a panel opened before anything was asked for", () => {
        const community: RightPanelContent = { kind: "community_details" };
        expect(historyWith([], community)).toEqual([{ kind: "group_details" }, community]);
        expect(historyWith([{ kind: "show_group_members" }], community)).toEqual([
            { kind: "show_group_members" },
            community,
        ]);
    });
});
