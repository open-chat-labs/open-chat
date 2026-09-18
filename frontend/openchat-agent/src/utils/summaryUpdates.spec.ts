import type { CommunityIdentifier, GroupChatIdentifier } from "@shared";
import { describe, expect, test } from "vitest";
import { mergeWaitAllResults, summaryUpdatesArgsByLocalUserIndex } from "./summaryUpdates";

const group = (groupId: string, localUserIndex: string, lastUpdated?: bigint) => ({
    id: { kind: "group_chat", groupId } as GroupChatIdentifier,
    localUserIndex,
    lastUpdated,
});
const community = (communityId: string, localUserIndex: string, lastUpdated?: bigint) => ({
    id: { kind: "community", communityId } as CommunityIdentifier,
    localUserIndex,
    lastUpdated,
});

describe("summaryUpdatesArgsByLocalUserIndex", () => {
    test("groups the requests by local user index, asking since each chat's lastUpdated", () => {
        const args = summaryUpdatesArgsByLocalUserIndex(
            [group("g1", "lui1", 10n), group("g2", "lui2", 20n)],
            [community("c1", "lui1", 30n)],
        );

        expect([...args.keys()]).toEqual(["lui1", "lui2"]);
        expect(args.get("lui1")).toEqual([
            { canisterId: "g1", isCommunity: false, inviteCode: undefined, updatesSince: 10n },
            { canisterId: "c1", isCommunity: true, inviteCode: undefined, updatesSince: 30n },
        ]);
        expect(args.get("lui2")).toEqual([
            { canisterId: "g2", isCommunity: false, inviteCode: undefined, updatesSince: 20n },
        ]);
    });

    test("a chat just added has no lastUpdated, so it is fetched in full", () => {
        const args = summaryUpdatesArgsByLocalUserIndex([group("g1", "lui1")], []);
        expect(args.get("lui1")?.[0].updatesSince).toBeUndefined();
    });
});

describe("mergeWaitAllResults", () => {
    test("concatenates successes and errors, skipping results never started", () => {
        expect(
            mergeWaitAllResults([
                { success: [1, 2], errors: ["a"] },
                undefined,
                { success: [3], errors: [] },
            ]),
        ).toEqual({ success: [1, 2, 3], errors: ["a"] });
        expect(mergeWaitAllResults([undefined, undefined])).toEqual({ success: [], errors: [] });
    });
});
