import type { CommunitySummary, MultiUserChat, OpenChat } from "@client";
import { describe, expect, test } from "vitest";
import { ROLE_ADMIN, ROLE_MEMBER, ROLE_OWNER } from "@client";
import {
    chatDetailsPermissions,
    chatManageAccess,
    chatRulesText,
    communityDetailsPermissions,
} from "./detailsPermissions";

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

describe("chat rules text", () => {
    // #10112 "Behaviours to keep": rules show only to someone who can send, combined with the community's
    test("shows the combined rules to someone who can send, and nothing to anyone else", () => {
        const rules = (canSend: boolean) =>
            ({
                canSendMessage: () => canSend,
                combineRulesText: () => "chat rules + community rules",
            }) as never as OpenChat;
        expect(chatRulesText(rules(true), channel, undefined, undefined)).toBe(
            "chat rules + community rules",
        );
        expect(chatRulesText(rules(false), channel, undefined, undefined)).toBe("");
    });
});

describe("chatManageAccess", () => {
    const group = (role: number) =>
        ({
            kind: "group_chat",
            id: { kind: "group_chat", groupId: "g" },
            membership: { role },
        }) as MultiUserChat;
    // a viewer the group lets edit details (`edit`), who owns it or not (`owner`)
    const viewer = ({ edit, owner }: { edit: boolean; owner: boolean }) =>
        ({
            ...client({}),
            canEditGroupDetails: () => edit,
            canChangePermissions: () => owner,
        }) as never as OpenChat;

    // 4b invariant 7: a member without edit rights gets the About page
    test("a member who can't edit the group gets the About page", () => {
        expect(
            chatManageAccess(
                viewer({ edit: false, owner: false }),
                group(ROLE_MEMBER),
                undefined,
                false,
            ),
        ).toEqual({ kind: "about" });
    });

    // 4b invariant 7: a section the user's role can't change is read-only
    test("an admin edits the group but not its permissions, disappearing messages or visibility", () => {
        expect(
            chatManageAccess(
                viewer({ edit: true, owner: false }),
                group(ROLE_ADMIN),
                undefined,
                false,
            ),
        ).toEqual({ kind: "edit", readOnly: ["permissions", "disappearing", "visibility"] });
    });

    test("the owner edits everything", () => {
        expect(
            chatManageAccess(
                viewer({ edit: true, owner: true }),
                group(ROLE_OWNER),
                undefined,
                false,
            ),
        ).toEqual({ kind: "edit", readOnly: [] });
    });
});
