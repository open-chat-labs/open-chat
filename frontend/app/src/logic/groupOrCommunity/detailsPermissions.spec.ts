import type { CommunitySummary, MultiUserChat, OpenChat } from "@client";
import { describe, expect, test } from "vitest";
import { ROLE_ADMIN, ROLE_MEMBER, ROLE_OWNER } from "@client";
import {
    chatDetailsPermissions,
    chatManageAccess,
    communityManageAccess,
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
        canAddMembers: () => true,
        canEditCommunity: () => true,
        canDeleteCommunity: () => true,
    } as never as OpenChat;
}

const all = { canEdit: true, canDelete: true, canInvite: true, canOpenInvite: true };
const none = { canEdit: false, canDelete: false, canInvite: false, canOpenInvite: false };

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

    // 4b: the invite dialog is still offered for a private channel (its Add tab), and to any
    // member of a public chat (to share its link), as the old menus did
    test("the invite dialog opens for a private channel's inviter and a public chat's member", () => {
        expect(
            chatDetailsPermissions(client({}, true), channel, community, false).canOpenInvite,
        ).toBe(true);
        const member = {
            ...client({}),
            canInviteUsers: () => false,
            canAddMembers: () => false,
        } as never as OpenChat;
        const open = (isPublic: boolean) =>
            chatDetailsPermissions(member, { ...channel, public: isPublic }, community, false)
                .canOpenInvite;
        expect(open(true)).toBe(true);
        expect(open(false)).toBe(false);
        // someone who may add members but not invite still gets the dialog's Add tab
        const adder = { ...member, canAddMembers: () => true } as never as OpenChat;
        expect(chatDetailsPermissions(adder, channel, community, false).canOpenInvite).toBe(true);
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

describe("communityManageAccess", () => {
    const owned = (role: number) => ({ ...community, membership: { role } }) as CommunitySummary;
    const viewer = ({ edit, owner }: { edit: boolean; owner: boolean }) =>
        ({
            ...client({}),
            canEditCommunity: () => edit,
            canChangeCommunityPermissions: () => owner,
        }) as never as OpenChat;

    // 4b invariant 7, for a community
    test("a member who can't edit the community gets the About page", () => {
        expect(
            communityManageAccess(viewer({ edit: false, owner: false }), owned(ROLE_MEMBER), false),
        ).toEqual({ kind: "about" });
    });

    test("an admin edits the community but not its permissions or visibility", () => {
        expect(
            communityManageAccess(viewer({ edit: true, owner: false }), owned(ROLE_ADMIN), false),
        ).toEqual({ kind: "edit", readOnly: ["permissions", "visibility"] });
    });

    test("the owner edits everything", () => {
        expect(
            communityManageAccess(viewer({ edit: true, owner: true }), owned(ROLE_OWNER), false),
        ).toEqual({ kind: "edit", readOnly: [] });
    });
});
