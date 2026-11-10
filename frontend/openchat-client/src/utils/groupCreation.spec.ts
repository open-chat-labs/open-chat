import type { ChatEvent, EventWrapper } from "@shared";
import { describe, expect, test } from "vitest";
import { groupCreation } from "./groupCreation";

function wrap(event: ChatEvent, index: number, timestamp: bigint): EventWrapper<ChatEvent> {
    return { event, index, timestamp };
}

describe("groupCreation", () => {
    test("is the group_chat_created event's time and creator", () => {
        const created = wrap(
            { kind: "group_chat_created", name: "Book Club", description: "", created_by: "u1" },
            0,
            1700000000000n,
        );
        expect(groupCreation([created])).toEqual({ timestamp: 1700000000000n, createdBy: "u1" });
    });

    test("is unknown when the event wasn't read (history hidden, or none came back)", () => {
        expect(groupCreation([])).toBeUndefined();
        expect(groupCreation([wrap({ kind: "direct_chat_created" }, 0, 1n)])).toBeUndefined();
    });
});
