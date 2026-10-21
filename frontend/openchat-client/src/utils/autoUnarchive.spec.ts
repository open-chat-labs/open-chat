import { ChatSet, type ChatIdentifier, type ChatSummary } from "@shared";
import { describe, expect, test, vi } from "vitest";
import { unarchiveChatsWithUnread } from "./autoUnarchive";

function chat(groupId: string, archived: boolean, unread: number): ChatSummary {
    return {
        kind: "group_chat",
        id: { kind: "group_chat", groupId },
        membership: { archived },
        unread,
    } as unknown as ChatSummary;
}

const unread = (c: ChatSummary) => (c as unknown as { unread: number }).unread;

function deferred() {
    let resolve!: (ok: boolean) => void;
    const promise = new Promise<boolean>((r) => (resolve = r));
    return { promise, resolve };
}

describe("unarchiveChatsWithUnread", () => {
    test("unarchives only archived chats that have unread messages", async () => {
        const unarchive = vi.fn((_: ChatIdentifier) => Promise.resolve(true));
        await Promise.all(
            unarchiveChatsWithUnread(
                [chat("a", true, 2), chat("b", true, 0), chat("c", false, 5)],
                unread,
                new ChatSet(),
                unarchive,
                () => {},
            ),
        );
        expect(unarchive.mock.calls.map(([id]) => id)).toEqual([
            { kind: "group_chat", groupId: "a" },
        ]);
    });

    test("asks once per chat while its request is in flight, and again once it settles", async () => {
        const inFlight = new ChatSet();
        const pending = deferred();
        const unarchive = vi.fn((_: ChatIdentifier) => pending.promise);
        const a = chat("a", true, 1);

        const first = unarchiveChatsWithUnread([a], unread, inFlight, unarchive, () => {});
        unarchiveChatsWithUnread([a, a], unread, inFlight, unarchive, () => {});
        expect(unarchive).toHaveBeenCalledTimes(1);

        pending.resolve(false);
        await Promise.all(first);
        unarchiveChatsWithUnread([a], unread, inFlight, unarchive, () => {});
        expect(unarchive).toHaveBeenCalledTimes(2);
    });

    test("reports each failed request once, whether it fails or throws, and never a success", async () => {
        const failed = vi.fn();
        const outcomes: Record<string, () => Promise<boolean>> = {
            ok: () => Promise.resolve(true),
            no: () => Promise.resolve(false),
            err: () => Promise.reject(new Error("offline")),
        };
        await Promise.all(
            unarchiveChatsWithUnread(
                [chat("ok", true, 1), chat("no", true, 1), chat("err", true, 1)],
                unread,
                new ChatSet(),
                (id) => outcomes[(id as { groupId: string }).groupId](),
                failed,
            ),
        );
        expect(failed).toHaveBeenCalledTimes(2);
    });
});
