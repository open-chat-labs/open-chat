import {
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    type CommunityPermissionRole,
    type CommunityPermissions,
    type CommunitySummary,
    type VersionedRules,
} from "@client";
import {
    MAX_DESC_LENGTH,
    MAX_NAME_LENGTH,
    MIN_NAME_LENGTH,
} from "@src/logic/groupOrCommunity/community.svelte";
import { defaultCommunityPermissions } from "@src/stores/community";
import type { CommunitySettingsPage } from "../../router/locations";
import type { PermissionRow, Translate } from "../groupSettings/settings.adapter";

// A community's settings pages (native plan 12 "Community details" → Manage, on plan 11's pages):
// their titles, when a page can make its draft, the Edit community page's checks, and the
// community's permissions (its seven, for owners, admins or members) as the Permissions page
// shows them. Words come back translated through `t`.

/** A community settings page's title: Edit community, or its Manage row's. */
export function communityPageTitle(page: CommunitySettingsPage, t: Translate): string {
    switch (page) {
        case "edit":
            return t("native.communitySettings.edit");
        case "channels":
            return t("native.community.manage.channels");
        case "user_groups":
            return t("native.community.manage.userGroups");
        case "invite":
            return t("native.community.manage.invite");
        default:
            return t(`native.details.manage.${page}`);
    }
}

/**
 * Whether a page on the community's draft can make it: once the community is in, and for Rules
 * once its rules are too (they come as it's selected). A Rules draft made without them would hold
 * the default rules, and saving it would put those in place of the community's.
 */
export function communitySettingsReady(
    page: CommunitySettingsPage,
    community: CommunitySummary | undefined,
    rules: VersionedRules | undefined,
): boolean {
    return community !== undefined && (page !== "rules" || rules !== undefined);
}

/** Whether a name is as long as a community's may be, as it's saved: trimmed. */
export function communityNameValid(name: string): boolean {
    const length = name.trim().length;
    return length >= MIN_NAME_LENGTH && length <= MAX_NAME_LENGTH;
}

/**
 * Whether the draft can be saved: the shared editor's checks (`editorValid`: the rules, the name
 * untrimmed), the name trimmed as the page shows it, and a description no longer than a
 * community's may be, which the editor doesn't check.
 */
export function communityDraftSavable(community: CommunitySummary, editorValid: boolean): boolean {
    return (
        editorValid &&
        communityNameValid(community.name) &&
        community.description.length <= MAX_DESC_LENGTH
    );
}

// ── permissions ──

export type CommunityPermission = keyof CommunityPermissions;

/**
 * The Permissions page's cards (the plan has a group's; a community's seven are split as the web
 * dialog lists them): who runs the membership, then who makes channels and user groups.
 */
export const COMMUNITY_PERMISSION_CARDS: {
    card: "members" | "channels";
    permissions: CommunityPermission[];
}[] = [
    {
        card: "members",
        permissions: ["changeRoles", "updateDetails", "inviteUsers", "removeMembers"],
    },
    {
        card: "channels",
        permissions: ["createPublicChannel", "createPrivateChannel", "manageUserGroups"],
    },
];

// a community's roles: no moderators, and nothing is nobody's
const COMMUNITY_ROLE_IDS: [CommunityPermissionRole, string][] = [
    [ROLE_OWNER, "owner"],
    [ROLE_ADMIN, "admin"],
    [ROLE_MEMBER, "member"],
];

/** A community role as its menu's option id. */
export function communityRoleId(role: CommunityPermissionRole): string {
    return COMMUNITY_ROLE_IDS.find(([r]) => r === role)?.[1] ?? "admin";
}

/** The role an option id stands for. */
export function communityRoleOf(id: string): CommunityPermissionRole | undefined {
    return COMMUNITY_ROLE_IDS.find(([, i]) => i === id)?.[0];
}

/** A permission's role menu: the lowest role that has it, in a group's words. */
export function communityRoleOptions(t: Translate): { id: string; label: string }[] {
    return COMMUNITY_ROLE_IDS.map(([, id]) => ({
        id,
        label: t(`native.groupSettings.permissions.role.${id}`),
    }));
}

/** A card's permissions, each with its role and whether that's other than the default. */
export function communityPermissionRows(
    permissions: CommunityPermissions,
    card: "members" | "channels",
    t: Translate,
): PermissionRow[] {
    const defaults = defaultCommunityPermissions();
    const keys = COMMUNITY_PERMISSION_CARDS.find((c) => c.card === card)?.permissions ?? [];
    return keys.map((key) => ({
        key,
        label: t(`native.communitySettings.permissions.perm.${key}`),
        value: communityRoleId(permissions[key]),
        changed: permissions[key] !== defaults[key],
    }));
}

// ── user groups ──

export type UserGroupRow = { id: number; mention: string; members: string };

/** The User groups page's rows: each group as it's mentioned, with its size, by name. */
export function userGroupRows(
    groups: Iterable<{ id: number; name: string; members: ReadonlySet<string> }>,
    t: Translate,
): UserGroupRow[] {
    return [...groups]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({
            id: g.id,
            mention: `@${g.name}`,
            members: t("native.communitySettings.userGroups.members", { count: g.members.size }),
        }));
}

/**
 * The people a user group's page offers: the community's members it knows of matching the search
 * (`matches`: by name or @username, `memberMatchesSearch`; the user too, as the old editors had
 * it), by name.
 */
export function userGroupPeople<U extends { username: string; displayName?: string }>(
    members: readonly U[],
    matches: (user: U) => boolean,
): U[] {
    const name = (u: U) => u.displayName ?? u.username;
    return members.filter(matches).sort((a, b) => name(a).localeCompare(name(b)));
}

/** How many of the permissions are other than the defaults. */
export function changedCommunityPermissions(permissions: CommunityPermissions): number {
    const defaults = defaultCommunityPermissions();
    return COMMUNITY_PERMISSION_CARDS.flatMap((c) => c.permissions).filter(
        (key) => permissions[key] !== defaults[key],
    ).length;
}
