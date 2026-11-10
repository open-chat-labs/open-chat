import { compareRoles, ROLE_ADMIN, ROLE_MEMBER, ROLE_MODERATOR, ROLE_OWNER, type MemberRole } from "@client";
import type { NativeMenuItem } from "@openchat/ui/src/native/types";
import { durationParts, ttlDurationId } from "@src/logic/chats/disappearingMessages";
import type { MemberMenu } from "@src/logic/members/memberMenu";
import type { GroupSettingsPage } from "../../router/locations";

// A chat's details as the native screens show them (native plan 10, Design Notes §3.6): the tiles
// under the name, a group's Manage list, the values its rows show, and a member's ⋯ as menu items.
// The words come in from the screen (`t`), translated, as the kit shows its rows' labels as they
// are.

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** A tile under the name: a DM's Call / Search / Mute, a group's Mute / Search / Invite. */
export type DetailTileId = "call" | "search" | "mute" | "invite";

export type DetailTile = {
    id: DetailTileId;
    icon: string;
    label: string;
    /** A toggle that's on (muted): accent-tinted, as the web panel's tiles. */
    on: boolean;
};

function muteTile(muted: boolean, t: Translate): DetailTile {
    return {
        id: "mute",
        icon: muted ? "bell" : "bell-off",
        label: t(muted ? "native.details.tiles.unmute" : "native.details.tiles.mute"),
        on: muted,
    };
}

function searchTile(t: Translate): DetailTile {
    return { id: "search", icon: "search", label: t("native.details.tiles.search"), on: false };
}

/**
 * A DM's tiles: Call / Search / Mute. Call only where calls can be started in it, and Mute not
 * for a bot (a DM with a bot can't be muted, as the conversation's menu has it).
 */
export function dmTiles(
    state: { canCall: boolean; muted: boolean; isBot: boolean },
    t: Translate,
): DetailTile[] {
    return [
        ...(state.canCall
            ? [{ id: "call" as const, icon: "phone", label: t("native.details.tiles.call"), on: false }]
            : []),
        searchTile(t),
        ...(state.isBot ? [] : [muteTile(state.muted, t)]),
    ];
}

/**
 * Whether the tiles hold only Search (a bot's DM: no Call, no Mute): a row of one looks odd, so
 * Search goes on the cover, by Favourite, and there's no row.
 */
export function searchOnCover(tiles: DetailTile[]): boolean {
    return tiles.length === 1 && tiles[0].id === "search";
}

/** A group's or channel's tiles: Mute / Search / Invite, Invite only for someone who can invite. */
export function groupTiles(state: { canInvite: boolean; muted: boolean }, t: Translate): DetailTile[] {
    return [
        muteTile(state.muted, t),
        searchTile(t),
        ...(state.canInvite
            ? [{ id: "invite" as const, icon: "invite", label: t("native.details.tiles.invite"), on: false }]
            : []),
    ];
}

/** Manage is for owners and admins (plan 10's acceptance), in a chat they can act in. */
export function showsManage(role: MemberRole, frozen: boolean): boolean {
    return !frozen && compareRoles(role, ROLE_ADMIN) >= 0;
}

export type ManageRow = { page: GroupSettingsPage; icon: string; label: string };

/** Manage's rows, in the design's order: Access gates, Rules, Permissions, Bots and webhooks, Stats. */
export function manageRows(t: Translate): ManageRow[] {
    return [
        { page: "gates", icon: "gate", label: t("native.details.manage.gates") },
        { page: "rules", icon: "rules", label: t("native.details.manage.rules") },
        { page: "permissions", icon: "shield", label: t("native.details.manage.permissions") },
        { page: "bots", icon: "bot", label: t("native.details.manage.bots") },
        { page: "stats", icon: "chart", label: t("native.details.manage.stats") },
    ];
}

/** A duration id ("8 hours") in the app's language. */
export function durationLabel(id: string, t: Translate): string {
    const parts = durationParts(id);
    return parts === undefined
        ? id
        : t(`native.details.duration.${parts.unit}`, { count: parts.count });
}

/** A group's disappearing messages as a value: Off, or how long they last. */
export function disappearingValue(ttl: bigint | undefined, t: Translate): string {
    return ttl === undefined ? t("native.you.off") : durationLabel(ttlDurationId(ttl), t);
}

/** Whether new members see the messages from before they joined. */
export function historyValue(visible: boolean, t: Translate): string {
    return t(visible ? "native.details.historyVisible" : "native.details.historyHidden");
}

const ROLE_WORDS: [MemberRole, string][] = [
    [ROLE_OWNER, "owner"],
    [ROLE_ADMIN, "admin"],
    [ROLE_MODERATOR, "moderator"],
    [ROLE_MEMBER, "member"],
];

/** A role's word in the keys ("owner", "admin" …); a role the app doesn't name is a member's. */
export function roleWord(role: MemberRole): string {
    return ROLE_WORDS.find(([r]) => r === role)?.[1] ?? "member";
}

/** A member's ⋯ as menu items: the roles first (`role:<n>`), then Remove and Block, after a divider. */
export function memberMenuItems(
    menu: Extract<MemberMenu, { kind: "actions" }>,
    t: Translate,
): NativeMenuItem[] {
    const roles: NativeMenuItem[] = menu.roles.map((role) => ({
        id: `role:${role}`,
        label: t(`native.details.members.make.${roleWord(role)}`),
        icon: role === ROLE_MEMBER ? "user" : "shield",
    }));
    const danger: NativeMenuItem[] = [
        ...(menu.remove
            ? [{ id: "remove", label: t("native.details.members.remove"), icon: "user-minus", danger: true }]
            : []),
        ...(menu.block
            ? [{ id: "block", label: t("native.details.members.block"), icon: "ban", danger: true }]
            : []),
    ];
    if (roles.length > 0 && danger.length > 0) danger[0] = { ...danger[0], separator: true };
    return [...roles, ...danger];
}

/** The role a `role:<n>` menu item gives. */
export function menuItemRole(id: string): MemberRole | undefined {
    const m = id.match(/^role:(\d+)$/);
    if (m === null) return undefined;
    return ROLE_WORDS.find(([r]) => r === Number(m[1]))?.[0];
}
