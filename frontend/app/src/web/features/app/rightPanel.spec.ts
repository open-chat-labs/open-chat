import type { RightPanelContent } from "@client";
import { describe, expect, test } from "vitest";
import { columnChange, historyWith, rightColumnPanel } from "./rightPanel";

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

describe("columnChange", () => {
    const details: RightPanelContent = { kind: "group_details" };
    const none: RightPanelContent = { kind: "no_panel" };

    test("what the column held when it started, or the same panel again, changes nothing", () => {
        expect(columnChange(undefined, thread)).toBe("none");
        expect(columnChange(undefined, details)).toBe("none");
        expect(columnChange(thread, thread)).toBe("none");
    });

    test("a thread shows the column, from nothing, another panel or another thread", () => {
        expect(columnChange(none, thread)).toBe("show_thread");
        expect(columnChange(details, thread)).toBe("show_thread");
        expect(columnChange(thread, { ...thread, threadRootMessageIndex: 4 })).toBe("show_thread");
    });

    test("the thread going leaves the column as the user had it", () => {
        expect(columnChange(thread, none)).toBe("thread_closed");
    });

    test("any other panel asked for opens it, over a thread too; nothing left changes nothing", () => {
        expect(columnChange(none, details)).toBe("open");
        expect(columnChange(thread, { kind: "show_group_members" })).toBe("open");
        expect(columnChange(details, none)).toBe("none");
    });
});
