import {
    memberRoleChoices,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_OWNER,
    type CommunitySummary,
    type FullMember,
    type MemberActions,
    type MemberRole,
    type MultiUserChat,
    type UserGroupDetails,
    type UserLookup,
    type UserSummary,
    type WebhookDetails,
    type ExternalBotLike,
} from "@client";
import type { MemberRole as PanelRole } from "@openchat/ui/src/features/components/GroupPanel.svelte";
import type { InvitePerson } from "@openchat/ui/src/features/components/InviteDialog.svelte";
import type { UserGroupPerson } from "@openchat/ui/src/features/components/UserGroupDialog.svelte";
import { pickById } from "../../pickById";

// GroupPanel's people, pins and user groups from the app's members, pinned messages and user
// groups. What a viewer may do to each member is decided before this (memberActions).

const COLORS = ["violet", "amber", "teal", "blue"] as const;

const PANEL_ROLES: [MemberRole, PanelRole][] = [
    [ROLE_OWNER, "OWNER"],
    [ROLE_ADMIN, "ADMIN"],
    [ROLE_MODERATOR, "MODERATOR"],
    [ROLE_MEMBER, "MEMBER"],
];

export function panelRole(role: MemberRole): PanelRole {
    return PANEL_ROLES.find(([r]) => r === role)?.[1] ?? "MEMBER";
}

export function appRole(role: PanelRole): MemberRole {
    return PANEL_ROLES.find(([, r]) => r === role)?.[0] ?? ROLE_MEMBER;
}

// a member's tag: their role, or nothing for a plain member
function roleTag(role: MemberRole): string {
    const name = panelRole(role);
    return name === "MEMBER" ? "" : name;
}

/** A member's row; `actions` is what the viewer may do to them. */
export function memberPerson(member: FullMember, me: string, actions: MemberActions) {
    return {
        title: member.displayName ?? member.username,
        handle: member.username,
        userId: member.userId,
        tag: member.userId === me ? "YOU" : roleTag(member.role),
        color: pickById(member.userId, COLORS),
        actions: {
            roles: memberRoleChoices(actions).map(panelRole),
            remove: actions.canRemoveMember,
            block: actions.canBlockUser,
        },
    };
}

/** A lapsed or blocked user's row. */
export function userPerson(user: UserSummary, tag: "LAPSED" | "BLOCKED") {
    return {
        title: user.displayName ?? user.username,
        handle: user.username,
        userId: user.userId,
        tag,
        color: pickById(user.userId, COLORS),
    };
}

/** A pinned message's row, from its text and when it was sent, as the screen formats them. */
export function pinRow(pin: {
    messageId: bigint;
    senderId: string;
    author: string;
    text: string;
    date: string;
    time: string;
}) {
    return {
        messageId: String(pin.messageId),
        date: pin.date,
        author: pin.author,
        authorId: pin.senderId,
        color: pickById(pin.senderId, COLORS),
        text: pin.text,
        time: pin.time,
    };
}

/** A community's user group, with the members whose users are held. */
export function userGroupRow(group: UserGroupDetails, users: UserLookup) {
    return {
        key: String(group.id),
        title: group.name,
        members: [...group.members].flatMap((userId) => {
            const user = users.get(userId);
            return user === undefined
                ? []
                : [
                      {
                          userId,
                          name: user.displayName ?? user.username,
                          handle: user.username,
                          color: pickById(userId, COLORS),
                      },
                  ];
        }),
    };
}

/** A bot as GroupPanel lists it, installed or one to add. */
export function botRow(bot: ExternalBotLike) {
    return {
        id: bot.id,
        variant: "bot" as const,
        title: bot.name,
        subtitle: bot.definition.description,
        color: pickById(bot.id, COLORS),
        image: bot.avatarUrl,
    };
}

/** A webhook as GroupPanel lists it. */
export function webhookRow(webhook: WebhookDetails) {
    return {
        id: webhook.id,
        variant: "webhook" as const,
        title: webhook.name,
        color: pickById(webhook.id, COLORS),
        image: webhook.avatarUrl,
    };
}

/** A user group member, or someone to add, as UserGroupDialog shows them. */
export function userGroupPerson(userId: string, user: UserSummary | undefined): UserGroupPerson {
    return {
        userId,
        name: user === undefined ? userId : (user.displayName ?? user.username),
        handle: user?.username ?? "",
        color: pickById(userId, COLORS),
    };
}

/**
 * The group UserGroupDialog edits: every member, including those whose users aren't held yet, as
 * the dialog saves the members it shows and a member left out would be removed (4b invariant 5).
 */
export function userGroupDialogGroup(group: UserGroupDetails, users: UserLookup) {
    return {
        key: String(group.id),
        title: group.name,
        mention: `@${group.name}`,
        members: [...group.members].map((userId) => userGroupPerson(userId, users.get(userId))),
    };
}

/**
 * The panel's header from a group's, channel's or community's summary. The member count is the
 * summary's: a large chat holds only its first page of members.
 */
export function panelHeader(
    summary: MultiUserChat | CommunitySummary,
    about: string,
    avatarUrl: string | undefined,
) {
    return {
        title: summary.name,
        about,
        avatar: avatarUrl ?? "",
        isPublic: summary.public,
        memberTotal: summary.memberCount,
        viewerRole: panelRole(summary.membership.role),
    };
}

/** Someone InviteDialog can add or invite. */
export function invitePerson(user: UserSummary): InvitePerson {
    return {
        id: user.userId,
        name: user.displayName ?? user.username,
        handle: user.username,
        color: pickById(user.userId, COLORS),
    };
}
