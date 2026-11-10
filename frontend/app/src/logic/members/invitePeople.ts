import {
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    type ChatPermissionRole,
    type CommunitySummary,
    type MultiUserChat,
    type OpenChat,
} from "@client";
import { chatDetailsPermissions } from "../groupOrCommunity/detailsPermissions";

// Who may open the Invite people screen (the native design's plan 10) and what it offers them: its
// People tab (inviting people by name, or adding a private community's members to a channel) and
// its Invite link tab (a public chat's link, or a private one's for those who may invite), and how
// each person found would join. The permissions are those the details already use (a member's
// "Invite users" and "Add members", a public chat's link), so the screen and its Invite tile agree.

/** A tab of the Invite people screen. */
export type InviteTab = "people" | "link";

/** What the Invite people screen offers someone, or a toast that their role can't invite. */
export type InviteAccess =
    | { kind: "not_allowed" }
    | {
          kind: "allowed";
          /** The tabs, in the design's order; one alone shows without the tab bar. */
          tabs: InviteTab[];
          /** People can be invited by name ("Invite users"). */
          invite: boolean;
          /** A private community's members can be added to the channel ("Add members"). */
          add: boolean;
          /** The link can be switched off and on and reset (a private chat's, with "Invite users"). */
          manageLink: boolean;
      };

export type InviteAccessState = {
    /** A member of the chat (a previewer has no Invite). */
    member: boolean;
    /** Not frozen, and not a guest: nothing is offered otherwise (`chatDetailsPermissions`). */
    active: boolean;
    /** May invite people by name (`MemberManagement.canInvite`). */
    canInviteUsers: boolean;
    /** May add community members to a private community's channel (`MemberManagement.canAdd`). */
    canAddMembers: boolean;
    /** May share and manage the link (`chatDetailsPermissions`' canInvite). */
    canInviteByLink: boolean;
    /** A public chat: its link is always on, and anyone in it may share it. */
    public: boolean;
};

/**
 * What a member may do on the Invite people screen: People for those who may invite or add, the
 * Invite link for a public chat's members and those who may invite by link. With neither, the Invite
 * tile says, in a toast, who can.
 */
export function inviteAccess(state: InviteAccessState): InviteAccess {
    if (!state.member || !state.active) return { kind: "not_allowed" };
    const invite = state.canInviteUsers;
    const add = state.canAddMembers;
    const tabs: InviteTab[] = [
        ...(invite || add ? (["people"] as const) : []),
        ...(state.public || state.canInviteByLink ? (["link"] as const) : []),
    ];
    if (tabs.length === 0) return { kind: "not_allowed" };
    return { kind: "allowed", tabs, invite, add, manageLink: state.canInviteByLink };
}

/**
 * `inviteAccess` for a group or channel (its community, for a channel): the details' permissions
 * (`chatDetailsPermissions`: nothing for a guest or in a frozen chat), inviting by name as the
 * invite pages have it (`MemberManagement.canInvite`), and adding as `MemberManagement.canAdd`
 * (a private community's channel).
 */
export function chatInviteAccess(
    client: OpenChat,
    chat: MultiUserChat,
    community: CommunitySummary | undefined,
    anon: boolean,
): InviteAccess {
    const permissions = chatDetailsPermissions(client, chat, community, anon);
    return inviteAccess({
        member: chat.membership.role !== ROLE_NONE,
        active: permissions.canOpenInvite,
        canInviteUsers: client.canInviteUsers(chat.id),
        canAddMembers:
            chat.kind === "channel" &&
            community !== undefined &&
            !community.public &&
            client.canAddMembers(chat.id),
        canInviteByLink: permissions.canInvite,
        public: chat.public,
    });
}

/**
 * The lowest role that may invite here, which the "Only admins can invite" toast names: the
 * permission's own, or owners where it's set to no one.
 */
export function inviteRole(
    permission: ChatPermissionRole,
): "owner" | "admin" | "moderator" | "member" {
    switch (permission) {
        case ROLE_MEMBER:
            return "member";
        case ROLE_MODERATOR:
            return "moderator";
        case ROLE_ADMIN:
            return "admin";
        default:
            return "owner";
    }
}

/**
 * How someone the People tab lists would join: already a member, already invited, added (a
 * member of a private community, to its channel), invited, or not at all (someone outside a
 * channel's community, for a viewer who may not invite to the community).
 */
export type InviteWay = "member" | "invited" | "add" | "invite" | "none";

export type InviteWayContext = {
    me: string;
    members: { has(userId: string): boolean };
    /** Members who no longer meet the access gates: still members, whom the backend won't invite. */
    lapsed: { has(userId: string): boolean };
    invited: { has(userId: string): boolean };
    /** A channel's community's members held; undefined for a group or a community. */
    communityMembers: { has(userId: string): boolean } | undefined;
    invite: boolean;
    add: boolean;
    /** Whether people outside a channel's community can be invited to it (by inviting them to the community too). */
    inviteOutsiders: boolean;
};

export function inviteWay(userId: string, ctx: InviteWayContext): InviteWay {
    if (userId === ctx.me || ctx.members.has(userId) || ctx.lapsed.has(userId)) return "member";
    if (ctx.invited.has(userId)) return "invited";
    if (ctx.communityMembers === undefined) return ctx.invite ? "invite" : "none";
    if (ctx.communityMembers.has(userId)) {
        return ctx.add ? "add" : ctx.invite ? "invite" : "none";
    }
    return ctx.invite && ctx.inviteOutsiders ? "invite" : "none";
}

/** Whether a person can be picked: someone who'd be added or invited. */
export function pickable(way: InviteWay): way is "add" | "invite" {
    return way === "add" || way === "invite";
}

/** As many people as Suggested lists: as many as the old invite pages suggested. */
export const SUGGESTED_LIMIT = 30;

/**
 * The People tab's lists, from the people it knows of: with nothing searched, Pending (the
 * invited) and Suggested (the first `SUGGESTED_LIMIT` of those `suggested` who can be picked: the
 * screen passes the people the user has DMs with, most recent first, `directChatUsers`, so those
 * already in the chat or invited aren't among them); with a search, Results: every match, members
 * and the invited marked, those who can't join here left out.
 */
export function invitePeopleLists<U extends { userId: string }>(
    input: {
        searching: boolean;
        invited: U[];
        suggested: U[];
        /** The search's matches: those found, then members and the invited who match. */
        matches: U[];
    },
    ctx: InviteWayContext,
): { pending: U[]; suggested: (U & { way: InviteWay })[]; results: (U & { way: InviteWay })[] } {
    const withWay = (users: U[]) => {
        const seen = new Set<string>();
        return users.flatMap((u) => {
            if (seen.has(u.userId)) return [];
            seen.add(u.userId);
            const way = inviteWay(u.userId, ctx);
            return way === "none" ? [] : [{ ...u, way }];
        });
    };
    if (input.searching) {
        return { pending: [], suggested: [], results: withWay(input.matches) };
    }
    return {
        pending: input.invited,
        suggested: withWay(input.suggested)
            .filter((u) => pickable(u.way))
            .slice(0, SUGGESTED_LIMIT),
        results: [],
    };
}
