import type { RightPanelContent } from "@client";
import { describe, expect, test } from "vitest";
import { rightColumnPanel } from "./rightPanel";

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
