import type { ExternalAchievement, LeaveOrDelete, MultiUserChatIdentifier } from "@client";
import type { DialogStack } from "../../shell/dialogStack.svelte";
import type { ProfileCard } from "@src/logic/profile/profileCard";
import type { Component } from "svelte";

// The app's dialogs, and the screen each one shows: plugged in here as screens are in screens.ts,
// one line each, `undefined` (a placeholder) until it's built. DialogHost shows them.
//
// Two kinds:
// - linked: a query param over whatever page is open, which people link to and Back closes
//   (ROUTES.md, decision 6): ?profile, ?chit, ?hof, ?diamond;
// - local: opened by the app itself (a name clicked in a message …), kept in a DialogStack, and
//   closed before any navigation (closeModalStack) and on Back.
//
// The app event dialogs (not found, no access …) aren't in the table: DialogHost shows them on
// their own, and only closing one leaves the page.

export type LinkedDialog =
    // `section`: the one it opens on (?profile=chit), from another dialog's link to it
    | { kind: "profile"; section?: ProfileLinkSection }
    | { kind: "diamond" }
    | { kind: "chit" }
    | { kind: "leaderboard" };

// someone's profile card, for a name clicked in a message; confirming leaving or deleting a chat or
// community, called `name`; or a group's or channel's settings (its About page for someone who
// can't edit it)
export type LocalDialog =
    | ({ kind: "user" } & ProfileCard)
    | { kind: "leave_or_delete"; action: LeaveOrDelete; name: string }
    | { kind: "group_settings"; chatId: MultiUserChatIdentifier; tab: GroupSettingsTab }
    // the ways to earn CHIT, over whatever opened it (the CHIT dialog, an achievement's toast),
    // with the one just earned picked out (`highlight`, an achievement's id or external name), and
    // the partners' achievements if the opener has them loaded (`external`)
    | { kind: "achievements"; highlight?: string; external?: Loaded<ExternalAchievement[]> }
    // buying streak insurance, over the CHIT dialog
    | { kind: "streak_insurance" };

/** Something loaded, and when (ms): whatever depends on the time it was loaded goes by that. */
export type Loaded<T> = { value: T; at: number };

/** The page GroupSettingsDialog opens on. */
export type GroupSettingsTab = "group" | "gates" | "rules" | "permissions";

/** The profile's sections a link can open it on. */
export type ProfileLinkSection = "chit";
const PROFILE_LINK_SECTIONS: string[] = ["chit"] satisfies ProfileLinkSection[];

export type AppDialog = LinkedDialog | LocalDialog;

/**
 * A dialog's screen gets the dialog it shows, closes it with onClose, and can open the app's own
 * dialogs over itself (`dialogs`).
 */
export type DialogProps<D extends AppDialog> = {
    dialog: D;
    onClose: () => void;
    dialogs: DialogStack<LocalDialog>;
};

type Loader<D extends AppDialog> = () => Promise<{ default: Component<DialogProps<D>> }>;

export type Dialogs = {
    [K in AppDialog["kind"]]: Loader<Extract<AppDialog, { kind: K }>> | undefined;
};

export const dialogs: Dialogs = {
    // the user's own profile and settings (8c)
    profile: () => import("../profile/ProfileDialogScreen.svelte"),

    // Diamond membership (8e)
    diamond: undefined,

    // the daily CHIT: the streak, today's claim, streak insurance (8d)
    chit: () => import("../chit/ChitDialogScreen.svelte"),

    // the CHIT leaderboard (8d)
    leaderboard: () => import("../chit/LeaderboardDialogScreen.svelte"),

    // someone's profile card. A dialog, not anchored to the name clicked as the old desktop card was
    user: () => import("../user/UserDialogScreen.svelte"),

    // confirming leaving or deleting a group, channel, DM or community (4b)
    leave_or_delete: () => import("../chats/LeaveOrDeleteDialogScreen.svelte"),

    // a group's or channel's settings, or its About page (4b)
    group_settings: () => import("../group/GroupSettingsDialogScreen.svelte"),

    // the ways to earn CHIT: every achievement and what it pays (8d)
    achievements: () => import("../chit/AchievementsDialogScreen.svelte"),

    // buying streak insurance (8d)
    streak_insurance: () => import("../chit/StreakInsuranceDialogScreen.svelte"),
};

// each linked dialog's query param, in the order they win when more than one is in the URL
const PARAMS: Record<LinkedDialog["kind"], string> = {
    profile: "profile",
    diamond: "diamond",
    chit: "chit",
    leaderboard: "hof",
};

// PARAMS' keys, in its order
const LINKED_KINDS = Object.keys(PARAMS) as LinkedDialog["kind"][];

/** The linked dialog the URL's query opens, if any: one at a time. */
export function linkedDialog(query: URLSearchParams): LinkedDialog | undefined {
    const kind = LINKED_KINDS.find((k) => query.has(PARAMS[k]));
    if (kind !== "profile") return kind && { kind };
    const section = query.get(PARAMS.profile);
    return section !== null && isProfileLinkSection(section) ? { kind, section } : { kind };
}

function isProfileLinkSection(value: string): value is ProfileLinkSection {
    return PROFILE_LINK_SECTIONS.includes(value);
}

/**
 * The linked dialog to show for the one the URL opens: none for the CHIT dialog while CHIT is off
 * (a link to ?chit, the old UI's prize-message link …), however it was opened.
 */
export function shownLinkedDialog(
    dialog: LinkedDialog | undefined,
    chitOff: boolean,
): LinkedDialog | undefined {
    return dialog?.kind === "chit" && chitOff ? undefined : dialog;
}

/** The query param that opens a linked dialog, which closing it drops. */
export function linkedDialogParam(dialog: LinkedDialog): string {
    return PARAMS[dialog.kind];
}

/**
 * The query that opens a linked dialog in place of the one showing (from the profile, Diamond:
 * Back returns to the profile), or undefined when it's already the one showing.
 */
export function openLinkedDialog(query: URLSearchParams, dialog: LinkedDialog): string | undefined {
    const showing = linkedDialog(query);
    if (showing?.kind === dialog.kind && sectionOf(showing) === sectionOf(dialog)) return undefined;
    const rest = new URLSearchParams(query);
    LINKED_KINDS.forEach((k) => rest.delete(PARAMS[k]));
    // a flag, as withQueryStringFlag writes it: no "=" (the profile's section is its value)
    const others = rest.toString();
    const section = sectionOf(dialog);
    const param = `${encodeURIComponent(PARAMS[dialog.kind])}${section === undefined ? "" : `=${section}`}`;
    return `?${others === "" ? "" : `${others}&`}${param}`;
}

/** The screens of the dialogs built so far, to load ahead of their first opening. */
export function builtDialogScreens(): (() => Promise<{ default: Component<never> }>)[] {
    return Object.values(dialogs).filter((load) => load !== undefined);
}

function sectionOf(dialog: LinkedDialog): ProfileLinkSection | undefined {
    return dialog.kind === "profile" ? dialog.section : undefined;
}
