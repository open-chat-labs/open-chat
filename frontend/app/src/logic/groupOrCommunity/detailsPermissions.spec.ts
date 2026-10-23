import type { CommunitySummary, MultiUserChat, OpenChat } from "@client";
import { describe, expect, test } from "vitest";
import { chatDetailsPermissions, communityDetailsPermissions } from "./detailsPermissions";

const channel = {
    kind: "channel",
    id: { kind: "channel", communityId: "c", channelId: 1 },
} as MultiUserChat;
const community = {
    kind: "community",
    id: { kind: "community", communityId: "c" },
} as CommunitySummary;

function client(frozen: { chat?: boolean; community?: boolean }, privateChat = false) {
    return {
        isChatFrozen: () => frozen.chat ?? false,
        isCommunityFrozen: () => frozen.community ?? false,
        isChatPrivate: () => privateChat,
        canEditGroupDetails: () => true,
        canDeleteGroup: () => true,
        canInviteUsers: () => true,
        canEditCommunity: () => true,
        canDeleteCommunity: () => true,
    } as never as OpenChat;
}

const all = { canEdit: true, canDelete: true, canInvite: true };
const none = { canEdit: false, canDelete: false, canInvite: false };

describe("details permissions", () => {
    // #10112 "Desktop vs mobile": a frozen chat or community, and a guest, get no edit, delete or invite
    test("a guest, a frozen channel and a frozen community offer nothing", () => {
        expect(chatDetailsPermissions(client({}), channel, community, false)).toEqual(all);
        expect(chatDetailsPermissions(client({}), channel, community, true)).toEqual(none);
        expect(chatDetailsPermissions(client({ chat: true }), channel, community, false)).toEqual(
            none,
        );
        expect(
            chatDetailsPermissions(client({ community: true }), channel, community, false),
        ).toEqual(none);
        expect(communityDetailsPermissions(client({ community: true }), community, false)).toEqual(
            none,
        );
        expect(communityDetailsPermissions(client({}), community, true)).toEqual(none);
    });

    test("a private channel's members are added, not invited", () => {
        expect(chatDetailsPermissions(client({}, true), channel, community, false).canInvite).toBe(
            false,
        );
    });
});
