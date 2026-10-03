import type { DirectChatSummary } from "@shared";
import { describe, expect, test, vi } from "vitest";
import { findMovedDirectChats, movedDirectChats } from "./movedDirectChats";

const chat = (userId: string, dateCreated = 1n) =>
    ({
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        dateCreated,
    }) as DirectChatSummary;

describe("movedDirectChats", () => {
    const latestUserIds = new Map([
        ["old1", "new1"],
        ["old2", "new2"],
    ]);

    test("a chat removed under a migrated user's old id is mapped to the chat added under their new id", () => {
        expect(
            movedDirectChats(
                ["old1"],
                [chat("new1"), chat("other")],
                [chat("old1")],
                latestUserIds,
            ),
        ).toEqual(new Map([["old1", "new1"]]));
    });

    test("a chat which wasn't cached is taken as moved, there being nothing to tell it apart by", () => {
        expect(movedDirectChats(["old1"], [chat("new1")], [], latestUserIds)).toEqual(
            new Map([["old1", "new1"]]),
        );
    });

    test("a chat removed under the id its user still has was deleted, not moved", () => {
        expect(movedDirectChats(["u1"], [chat("u1")], [chat("u1")], latestUserIds).size).toBe(0);
    });

    test("a chat whose migrated user had no chat added under their new id was deleted, not moved", () => {
        // As when both were kept, the one under the new id having come first, and the one under
        // the old id is then deleted
        expect(
            movedDirectChats(
                ["old1", "old2"],
                [chat("new2")],
                [chat("old1"), chat("old2")],
                latestUserIds,
            ),
        ).toEqual(new Map([["old2", "new2"]]));
    });

    test("a deleted chat, and a new one with its user since they were migrated, aren't taken for a move", () => {
        expect(
            movedDirectChats(["old1"], [chat("new1", 5n)], [chat("old1", 1n)], latestUserIds).size,
        ).toBe(0);
    });
});

describe("findMovedDirectChats", () => {
    const lookUp = (latest: [string, string][]) =>
        vi.fn((_: string[]) => Promise.resolve(new Map(latest) as ReadonlyMap<string, string>));

    test("looks the removed chats' users up by the ids the chats were under", async () => {
        const latestUserIds = lookUp([["old1", "new1"]]);

        const moved = await findMovedDirectChats(
            ["old1", "gone"],
            [chat("new1")],
            [chat("old1")],
            latestUserIds,
        );

        expect(latestUserIds).toHaveBeenCalledWith(["old1", "gone"]);
        expect(moved).toEqual(new Map([["old1", "new1"]]));
    });

    test("looks nothing up unless the answer both removed and added a chat", async () => {
        const latestUserIds = lookUp([["old1", "new1"]]);

        expect((await findMovedDirectChats(["old1"], [], [chat("old1")], latestUserIds)).size).toBe(
            0,
        );
        expect((await findMovedDirectChats([], [chat("new1")], [], latestUserIds)).size).toBe(0);
        expect(latestUserIds).not.toHaveBeenCalled();
    });

    test("throws if the users can't be looked up, rather than taking a move for a deletion", async () => {
        await expect(
            findMovedDirectChats(["old1"], [chat("new1")], [chat("old1")], () =>
                Promise.reject(new Error("UserIndex unreachable")),
            ),
        ).rejects.toThrow("UserIndex unreachable");
    });
});
