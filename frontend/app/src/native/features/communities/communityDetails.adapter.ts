import type { ChatSummary, CommunityPermissions, MemberRole, VersionedRules } from "@client";
import { ROLE_ADMIN, ROLE_NONE, ROLE_OWNER } from "@client";
import type { CommunitySettingsPage } from "../../router/locations";
import { changedCommunityPermissions } from "../communitySettings/communitySettings.adapter";
import type { DetailTile, Translate } from "../details/details.adapter";

// A community's details (the user's design prompt of 2026-11-25, on the native plan's 12
// "Community details"): the tiles, the mute that the tile and the "You in this community" switch
// share, the Info card a regular member sees, Manage's rows with what each holds, and who sees
// which. Words come back translated through `t`.

/** The tiles: Invite (for someone who may invite), Search, Mute or Unmute. */
export function communityTiles(
    state: { canInvite: boolean; muted: boolean },
    t: Translate,
): DetailTile[] {
    return [
        ...(state.canInvite
            ? [{ id: "invite" as const, icon: "plus", label: t("native.details.tiles.invite"), on: false }]
            : []),
        // TODO(design): the design has Search, and the app has no search of a community's own to
        // open from here (the user's to decide); it shows, disabled
        {
            id: "search" as const,
            icon: "search",
            label: t("native.details.tiles.search"),
            on: false,
            disabled: true,
        },
        {
            id: "mute" as const,
            icon: state.muted ? "bell" : "bell-off",
            label: t(state.muted ? "native.details.tiles.unmute" : "native.details.tiles.mute"),
            on: state.muted,
        },
    ];
}

/**
 * Whether the community is muted: every one of the user's channels in it is (the web's and the
 * old menus' rule), so none muted, or some, reads as not muted. A community with no channels of
 * the user's isn't.
 */
export function allChannelsMuted(channels: Iterable<Pick<ChatSummary, "membership">>): boolean {
    let any = false;
    for (const c of channels) {
        any = true;
        if (!c.membership.notificationsMuted) return false;
    }
    return any;
}

/** "You in this community"'s line under Mute all channels, which says what it does now. */
export function muteHelp(muted: boolean, t: Translate): string {
    return t(
        muted
            ? "native.communityDetails.muteHelpOn"
            : "native.communityDetails.muteHelpOff",
    );
}

/** Who sees what: Manage for those who may edit it (owners and admins), the Info rows for the rest. */
export function detailsSections(
    role: MemberRole,
    canEdit: boolean,
    frozen: boolean,
): { manage: boolean; info: boolean } {
    const member = role !== ROLE_NONE;
    const manage = member && !frozen && canEdit && (role === ROLE_OWNER || role === ROLE_ADMIN);
    return { manage, info: member && !manage };
}

/** The danger row: the owner deletes (an owner can't leave), anyone else leaves. */
export function dangerAction(
    canDelete: boolean,
    canLeave: boolean,
): "delete" | "leave" | undefined {
    return canDelete ? "delete" : canLeave ? "leave" : undefined;
}

/** How many rules a rules text holds: its lines with something on them; none while they're off. */
export function rulesCount(rules: Pick<VersionedRules, "enabled" | "text"> | undefined): number {
    if (rules === undefined || !rules.enabled) return 0;
    return rules.text.split("\n").filter((line) => line.trim() !== "").length;
}

export type InfoRow = { page: "channels" | "rules" | "gates"; icon: string; label: string; value: string };

/** The Info card's rows under Members, for a regular member: Channels, Rules and Access gates. */
export function infoRows(
    state: { channels: number; rules: number; gates: number },
    t: Translate,
): InfoRow[] {
    return [
        {
            page: "channels",
            icon: "hash",
            label: t("native.community.manage.channels"),
            value: String(state.channels),
        },
        {
            page: "rules",
            icon: "rules",
            label: t("native.details.manage.rules"),
            value:
                state.rules === 0
                    ? t("native.communityDetails.none")
                    : t("native.communityDetails.rulesCount", { count: state.rules }),
        },
        {
            page: "gates",
            icon: "lock",
            label: t("native.details.manage.gates"),
            value:
                state.gates === 0
                    ? t("native.communityDetails.none")
                    : t("native.communityDetails.gatesCount", { count: state.gates }),
        },
    ];
}

/** What Manage's rows say they hold: undefined until it's known (the invite link loading). */
export type ManageState = {
    channels: number;
    userGroups: number;
    /** The invite link: on (a public one's always is), off, or not known yet. */
    link: "on" | "off" | undefined;
    gates: number;
    rulesEnabled: boolean;
    permissions: CommunityPermissions;
    bots: number;
};

/** A Manage row's value: `set` false for None, Off and Default, which show quieter. */
export type ManageMeta = { value: string; set: boolean } | undefined;

export function manageMeta(page: CommunitySettingsPage, state: ManageState, t: Translate): ManageMeta {
    const none = { value: t("native.communityDetails.none"), set: false };
    switch (page) {
        case "channels":
            return { value: t("native.communityDetails.channelsCount", { count: state.channels }), set: true };
        case "user_groups":
            return state.userGroups === 0 ? none : { value: String(state.userGroups), set: true };
        case "invite":
            return state.link === undefined
                ? undefined
                : state.link === "on"
                  ? { value: t("native.communityDetails.linkOn"), set: true }
                  : { value: t("native.you.off"), set: false };
        case "gates":
            return state.gates === 0
                ? none
                : { value: t("native.communityDetails.gatesCount", { count: state.gates }), set: true };
        case "rules":
            return state.rulesEnabled
                ? { value: t("native.groupSettings.on"), set: true }
                : { value: t("native.you.off"), set: false };
        case "permissions": {
            const changed = changedCommunityPermissions(state.permissions);
            return changed === 0
                ? { value: t("native.groupSettings.permissions.default"), set: false }
                : {
                      value: t("native.groupSettings.permissions.changedCount", { count: changed }),
                      set: true,
                  };
        }
        case "bots":
            return state.bots === 0
                ? none
                : { value: t("native.communityDetails.botsCount", { count: state.bots }), set: true };
        default:
            return undefined;
    }
}
