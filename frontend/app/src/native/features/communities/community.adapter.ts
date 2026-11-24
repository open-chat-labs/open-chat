import {
    type ChannelMatch,
    type CombinedUnreadCounts,
    type CommunityIdentifier,
    type CommunitySummary,
    type ReadonlyMap,
} from "@client";
import type { NativeMenuItem } from "@openchat/ui/src/native/types";
import type { CommunitySettingsPage } from "../../router/locations";
import { canReadChannel, otherChannels } from "@src/logic/communities/otherChannels";
import { swatchFor, type Swatch } from "@src/logic/swatch";

// A community's page in the Communities tab (native plan 12, Design Notes §3.8): its header's
// menu, the channels it lists (the user's, then those they're not in), and the switcher's
// communities with each one's long-press menu.

/** What the header's kebab and a community's long-press menu do. */
export type CommunityAction =
    | "move_to_top"
    | "invite"
    | "mute_all"
    | "mark_all_read"
    | "manage"
    | "leave";

/** What the user may do with the community (logic/groupOrCommunity's communityMenuPermissions). */
export type CommunityMenuState = {
    canInvite: boolean;
    /** Owners and admins: Manage. */
    canManage: boolean;
    canLeave: boolean;
};

const ICONS: Record<CommunityAction, string> = {
    move_to_top: "pin",
    invite: "invite",
    mute_all: "bell-off",
    mark_all_read: "check-double",
    manage: "gear",
    leave: "exit",
};

function item(action: CommunityAction, label: (a: CommunityAction) => string): NativeMenuItem {
    return { id: action, label: label(action), icon: ICONS[action] };
}

/**
 * The header's kebab (plan 12 "Header"): Invite people, Mute all channels, Mark all as read, Manage
 * (owners and admins), Leave, each where the user may.
 */
export function headerMenuItems(
    state: CommunityMenuState,
    label: (action: CommunityAction) => string,
): NativeMenuItem[] {
    return [...(state.canInvite ? [item("invite", label)] : []), ...commonItems(state, label)];
}

/**
 * A community's long-press menu, in the strip or the sheet (plan 01 "Long-press row menu"; the
 * prototype's items, the plan having none): Move to top (but the first), Mute all channels, Mark
 * all as read, Manage, Leave.
 */
export function rowMenuItems(
    state: CommunityMenuState,
    first: boolean,
    label: (action: CommunityAction) => string,
): NativeMenuItem[] {
    return [...(first ? [] : [item("move_to_top", label)]), ...commonItems(state, label)];
}

function commonItems(
    state: CommunityMenuState,
    label: (action: CommunityAction) => string,
): NativeMenuItem[] {
    return [
        // every member's, whether or not its channels are muted already (the user's decision,
        // 2026-11-24: joined channels can start muted, and it hid the item)
        item("mute_all", label),
        item("mark_all_read", label),
        ...(state.canManage ? [item("manage", label)] : []),
        ...(state.canLeave ? [{ ...item("leave", label), danger: true, separator: true }] : []),
    ];
}

/** What a picked menu row (by its id) does. */
export function communityAction(id: string): CommunityAction | undefined {
    return (Object.keys(ICONS) as CommunityAction[]).find((a) => a === id);
}

// ---- the community's details

/** A row of the details' Manage card: the settings page it pushes. */
export type CommunityManageRow = { page: CommunitySettingsPage; icon: string; label: string };

/**
 * Manage's rows, in the plan's order (12 "Community details"): Channels, User groups, Invite and
 * share, Access gates, Rules, Permissions, Bots and webhooks, Stats.
 */
export function communityManageRows(label: (key: string) => string): CommunityManageRow[] {
    return [
        { page: "channels", icon: "hash", label: label("native.community.manage.channels") },
        { page: "user_groups", icon: "users", label: label("native.community.manage.userGroups") },
        { page: "invite", icon: "invite", label: label("native.community.manage.invite") },
        { page: "gates", icon: "lock", label: label("native.details.manage.gates") },
        { page: "rules", icon: "rules", label: label("native.details.manage.rules") },
        { page: "permissions", icon: "shield", label: label("native.details.manage.permissions") },
        { page: "bots", icon: "bot", label: label("native.details.manage.bots") },
        { page: "stats", icon: "chart", label: label("native.details.manage.stats") },
    ];
}

// ---- the channels

/**
 * The channels of the community the user isn't in that they can read (open to read with the join
 * bar: logic/communities' otherChannels and canReadChannel), in the order found. A private one
 * they aren't invited to can't be opened, so it isn't listed.
 */
export function channelsNotJoined(
    found: readonly ChannelMatch[],
    joined: { has: (id: ChannelMatch["id"]) => boolean },
): ChannelMatch[] {
    return otherChannels(found, joined).filter(canReadChannel);
}

/** A channel not joined as its row shows it ("Not joined · tap to read"). */
export type NotJoinedRow = {
    key: string;
    title: string;
    color: Swatch;
    avatarUrl: string | undefined;
    locked: boolean;
};

export function notJoinedRow(channel: ChannelMatch): NotJoinedRow {
    const key = `${channel.id.communityId}/${channel.id.channelId}`;
    return {
        key,
        title: channel.name,
        color: swatchFor(key),
        avatarUrl: channel.avatar.blobUrl,
        locked: !channel.public,
    };
}

// ---- the switcher's communities

/** A community in the switcher: the strip's avatar, the sheet's row. */
export type SwitcherCommunity = {
    id: CommunityIdentifier;
    key: string;
    name: string;
    avatarUrl: string | undefined;
    color: Swatch;
    /** Its channels' unread messages, not muted ones' (none shows no badge). */
    unread: number;
    /** "Public · 1,284 members" (`members`, in the app's words). */
    sub: string;
    current: boolean;
};

/**
 * The user's communities in the switcher, in their order (sortedCommunitiesStore), less those
 * only previewed and those waiting out a leave's Undo (`hidden`).
 */
export function switcherCommunities(
    communities: readonly CommunitySummary[],
    current: CommunityIdentifier,
    unread: ReadonlyMap<CommunityIdentifier, CombinedUnreadCounts>,
    previewing: (community: CommunitySummary) => boolean,
    hidden: (key: string) => boolean,
    members: (community: CommunitySummary) => string,
): SwitcherCommunity[] {
    return communities
        .filter((c) => !previewing(c) && !hidden(communityKey(c.id)))
        .map((c) => ({
            id: c.id,
            key: communityKey(c.id),
            name: c.name,
            avatarUrl: c.avatar.blobUrl,
            color: swatchFor(c.id.communityId),
            unread: unread.get(c.id)?.chats.unmuted ?? 0,
            sub: members(c),
            current: c.id.communityId === current.communityId,
        }));
}

/** A community's key in the shell's PendingRemovals (a leave waiting out its Undo). */
export function communityKey(id: CommunityIdentifier): string {
    return `community/${id.communityId}`;
}

/** The communities matching the sheet's search, by name. */
export function matchingCommunities<C extends { name: string }>(
    communities: readonly C[],
    query: string,
): C[] {
    const term = query.trim().toLowerCase();
    return term === ""
        ? [...communities]
        : communities.filter((c) => c.name.toLowerCase().includes(term));
}

/**
 * Where the tab goes once the community showing is left: the next one in the switcher, else the
 * one before, else none (Explore).
 */
export function nextCommunity(
    communities: readonly Pick<SwitcherCommunity, "id">[],
    leaving: CommunityIdentifier,
): CommunityIdentifier | undefined {
    const at = communities.findIndex((c) => c.id.communityId === leaving.communityId);
    const rest = communities.filter((c) => c.id.communityId !== leaving.communityId);
    if (rest.length === 0) return undefined;
    return rest[Math.min(Math.max(at, 0), rest.length - 1)].id;
}
