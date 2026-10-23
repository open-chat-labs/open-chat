import type { ChatSummary, CommunitySummary } from "@shared";
import { describe, expect, test } from "vitest";
import { profileBlock, type ProfileBlockInput } from "./profileBlock";

const dm = { kind: "direct_chat", id: { kind: "direct_chat", userId: "u" } } as ChatSummary;
const group = { kind: "group_chat", id: { kind: "group_chat", groupId: "g" } } as ChatSummary;
const channel = {
    kind: "channel",
    id: { kind: "channel", communityId: "c", channelId: 1 },
} as ChatSummary;
const community = {
    kind: "community",
    id: { kind: "community", communityId: "c" },
} as CommunitySummary;

function input(overrides: Partial<ProfileBlockInput>): ProfileBlockInput {
    return {
        userId: "u",
        isMe: false,
        inGlobalContext: false,
        chat: undefined,
        community: undefined,
        blockedUsers: new Set(),
        blockedChatUsers: new Set(),
        blockedCommunityUsers: new Set(),
        canBlockUsers: () => true,
        ...overrides,
    };
}

describe("profileBlock", () => {
    // 4a invariant 1: blocking from a profile blocks in the context it was opened from
    test("blocks in the DM for a DM, the group for a group, and the community for a channel or community", () => {
        expect(profileBlock(input({ chat: dm }))).toEqual({
            kind: "block",
            context: { kind: "direct_chat" },
        });
        expect(profileBlock(input({ chat: group, community }))).toEqual({
            kind: "block",
            context: { kind: "group_chat", id: group.id },
        });
        expect(profileBlock(input({ chat: channel, community }))).toEqual({
            kind: "block",
            context: { kind: "community", id: community.id },
        });
        expect(profileBlock(input({ community }))).toEqual({
            kind: "block",
            context: { kind: "community", id: community.id },
        });
    });

    test("offers unblock by the context's own blocked list", () => {
        expect(profileBlock(input({ chat: dm, blockedUsers: new Set(["u"]) })).kind).toBe(
            "unblock",
        );
        // blocked in the community, not in the group: the group's list decides
        expect(
            profileBlock(input({ chat: group, community, blockedCommunityUsers: new Set(["u"]) }))
                .kind,
        ).toBe("block");
        expect(
            profileBlock(input({ chat: channel, community, blockedCommunityUsers: new Set(["u"]) }))
                .kind,
        ).toBe("unblock");
    });

    test("offers nothing for yourself, from a global context, or without permission", () => {
        expect(profileBlock(input({ chat: dm, isMe: true })).kind).toBe("none");
        expect(profileBlock(input({ chat: group, inGlobalContext: true })).kind).toBe("none");
        expect(profileBlock(input({ chat: group, canBlockUsers: () => false })).kind).toBe("none");
    });
});
