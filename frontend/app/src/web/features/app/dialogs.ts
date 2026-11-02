import type {
    BotInstallationLocation,
    CommunityIdentifier,
    ExternalBotLike,
    GroupChatIdentifier,
    LeaveOrDelete,
    MultiUserChatIdentifier,
    PriceSubject,
} from "@client";
import type { DialogStack } from "../../shell/dialogStack.svelte";
import type { ManageSection } from "@src/logic/groupOrCommunity/manage.svelte";
import type { ProfileCard } from "@src/logic/profile/profileCard";
import type { Component } from "svelte";

// The app's dialogs, and the screen each one shows: plugged in here as screens are in screens.ts,
// one line each, `undefined` (a placeholder) until it's built. DialogHost shows them.
//
// Two kinds:
// - linked: a query param over whatever page is open, which people link to and Back closes
//   (ROUTES.md, decision 6): ?profile, ?chit, ?hof, ?diamond. The CHIT dialog's own views, the
//   ways to earn (?chit=earn), buying streak insurance (?chit=insurance), today's puzzle
//   (?chit=puzzle) and the claim calendar (?chit=calendar), are linked dialogs too, so one takes the CHIT dialog's place over the same
//   backdrop. A dialog opened from another (linkedDialogs.svelte.ts) has a back arrow to it, the
//   only way back; ×, the backdrop and Back close them all;
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
    // the ways to earn, with the one just earned picked out (`highlight`, an achievement's id or a
    // partner's achievement's name: ?chit=earn:<highlight>)
    | { kind: "achievements"; highlight?: string }
    | { kind: "streak_insurance" }
    // today's puzzle (with no `gameId`, the first on the rota: ?chit=puzzle), or that game's
    // (?chit=puzzle:<gameId>); `how`: opened on how to play (?chit=howto, ?chit=howto:<gameId>)
    | { kind: "puzzle"; gameId?: string; how?: boolean }
    // the claim calendar (?chit=calendar), from the CHIT dialog or the profile's CHIT section
    | { kind: "claim_history" }
    // picking a chat to share into what another app shared (/share?title&text&url, which redirects
    // to ?share=<the fields, as JSON>): its text goes into the chosen chat's draft
    | { kind: "share"; title?: string; text?: string; url?: string }
    | { kind: "leaderboard" };

// someone's profile card, for a name clicked in a message; a token's or coin's price card, for a
// cashtag clicked in one; confirming leaving or deleting a chat or community, called `name`; Manage
// for a group, channel or community (its settings, or its About page for someone who can't edit it,
// and inviting people or sharing its link); a new channel; or creating, editing or deleting one of a
// community's user groups
export type LocalDialog =
    | ({
          kind: "user";
          /** Your DM with them: the Profile / This chat tabs, opened on this one. */
          dmTab?: "profile" | "chat";
      } & ProfileCard)
    | { kind: "cashtag"; subject: PriceSubject }
    | { kind: "leave_or_delete"; action: LeaveOrDelete; name: string }
    | {
          kind: "manage";
          target: MultiUserChatIdentifier | CommunityIdentifier;
          section: ManageSection;
          /** Invite & share's tab, when it opens there. */
          inviteTab?: "people" | "share";
      }
    | { kind: "create_group"; level: "group" | "community" }
    | { kind: "convert_group"; chatId: GroupChatIdentifier }
    | {
          kind: "bot";
          /** Where it is, or would be, installed: a group, or a community (a channel's bots are its community's). */
          location: BotInstallationLocation;
          bot: ExternalBotLike;
      }
    | {
          kind: "webhook";
          chatId: MultiUserChatIdentifier;
          /** The webhook to edit; none registers one. */
          webhookId?: string;
      }
    | { kind: "import_group"; chatId: GroupChatIdentifier }
    | {
          kind: "new_channel";
          communityId: CommunityIdentifier;
          /** A channel that shows a web app in place of messages. */
          embedded: boolean;
      }
    | {
          kind: "user_group";
          communityId: CommunityIdentifier;
          mode: "create" | "edit" | "delete";
          userGroupId?: number;
      }
    // the wallet's settings: its token list, the transfer PIN and the display currency (6d)
    | { kind: "wallet_settings" };

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
    diamond: () => import("../diamond/DiamondDialogScreen.svelte"),

    // the daily CHIT: the streak, today's claim, streak insurance (8d)
    chit: () => import("../chit/ChitDialogScreen.svelte"),

    // the CHIT leaderboard (8d)
    leaderboard: () => import("../chit/LeaderboardDialogScreen.svelte"),

    // someone's profile card. A dialog, not anchored to the name clicked as the old desktop card was
    user: () => import("../user/UserDialogScreen.svelte"),

    // a token's or coin's price card, with its last 7 days' prices
    cashtag: () => import("../cashtag/TokenDialogScreen.svelte"),

    // confirming leaving or deleting a group, channel, DM or community (4b)
    leave_or_delete: () => import("../chats/LeaveOrDeleteDialogScreen.svelte"),

    // Manage for a group, channel or community: its settings (or About page) and Invite & share (4b)
    manage: () => import("../group/ManageDialogScreen.svelte"),

    // converting a group to a community, or importing it into one you own (4b)
    convert_group: () => import("../group/ConvertGroupDialogScreen.svelte"),
    import_group: () => import("../group/ImportGroupDialogScreen.svelte"),

    // a bot's details, installing it, changing its permissions or removing it (4b)
    bot: () => import("../group/BotDialogScreen.svelte"),

    // registering or editing a group's or channel's webhook (4b)
    webhook: () => import("../group/WebhookDialogScreen.svelte"),

    // a new group or community (4b)
    create_group: () => import("../group/CreateGroupDialogScreen.svelte"),

    // a new channel in a community, or an embedded one (4b)
    new_channel: () => import("../group/CreateChannelDialogScreen.svelte"),

    // creating, editing or deleting a community's user group (4b)
    user_group: () => import("../group/UserGroupDialogScreen.svelte"),

    // the ways to earn CHIT: every achievement and what it pays (8d)
    achievements: () => import("../chit/AchievementsDialogScreen.svelte"),

    // buying streak insurance (8d)
    streak_insurance: () => import("../chit/StreakInsuranceDialogScreen.svelte"),

    // today's daily puzzle (8d)
    puzzle: () => import("../chit/PuzzleDialogScreen.svelte"),

    // the CHIT claim calendar (8e)
    claim_history: () => import("../chit/ClaimHistoryDialogScreen.svelte"),

    // picking a chat to share into (4d)
    share: () => import("../share/ShareDialogScreen.svelte"),

    // the wallet's settings (6d)
    wallet_settings: () => import("../wallet/WalletSettingsDialogScreen.svelte"),
};

// each linked dialog's query param; the CHIT dialog's views share its param, told apart by its value
const PARAMS: Record<LinkedDialog["kind"], string> = {
    profile: "profile",
    diamond: "diamond",
    chit: "chit",
    achievements: "chit",
    streak_insurance: "chit",
    puzzle: "chit",
    claim_history: "chit",
    leaderboard: "hof",
    share: "share",
};

// the params, in the order they win when more than one is in the URL
const PARAM_ORDER = ["profile", "diamond", "chit", "hof", "share"];

// the CHIT dialog's views' values
const EARN = "earn";
const INSURANCE = "insurance";
const PUZZLE = "puzzle";
const HOW_TO = "howto";
const CALENDAR = "calendar";

/** The linked dialog the URL's query opens, if any: one at a time. */
export function linkedDialog(query: URLSearchParams): LinkedDialog | undefined {
    const param = PARAM_ORDER.find((p) => query.has(p));
    const value = (param && query.get(param)) ?? "";
    switch (param) {
        case undefined:
            return undefined;
        case "profile":
            return isProfileLinkSection(value)
                ? { kind: "profile", section: value }
                : { kind: "profile" };
        case "diamond":
            return { kind: "diamond" };
        case "hof":
            return { kind: "leaderboard" };
        case "share":
            return { kind: "share", ...sharedFields(value) };
        default:
            if (value === INSURANCE) return { kind: "streak_insurance" };
            if (value === CALENDAR) return { kind: "claim_history" };
            if (value === PUZZLE) return { kind: "puzzle" };
            if (value.startsWith(`${PUZZLE}:`)) {
                return { kind: "puzzle", gameId: value.slice(PUZZLE.length + 1) };
            }
            if (value === HOW_TO) return { kind: "puzzle", how: true };
            if (value.startsWith(`${HOW_TO}:`)) {
                return { kind: "puzzle", gameId: value.slice(HOW_TO.length + 1), how: true };
            }
            if (value === EARN) return { kind: "achievements" };
            if (value.startsWith(`${EARN}:`)) {
                return { kind: "achievements", highlight: value.slice(EARN.length + 1) };
            }
            return { kind: "chit" };
    }
}

// what was shared, from ?share's value (JSON): only its string fields, and nothing from a value that
// isn't JSON
function sharedFields(value: string): { title?: string; text?: string; url?: string } {
    try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== "object" || parsed === null) return {};
        const field = (key: string) => {
            const v: unknown = Reflect.get(parsed, key);
            return typeof v === "string" && v !== "" ? v : undefined;
        };
        return { title: field("title"), text: field("text"), url: field("url") };
    } catch {
        return {};
    }
}

/** The query that opens the share picker for what another app shared (/share?title&text&url). */
export function shareQuery(shared: { title: string; text: string; url: string }): string {
    // the fields alone: a route also carries its own kind
    const { title, text, url } = shared;
    return openLinkedDialog(new URLSearchParams(), { kind: "share", title, text, url }) ?? "";
}

function isProfileLinkSection(value: string): value is ProfileLinkSection {
    return PROFILE_LINK_SECTIONS.includes(value);
}

// a linked dialog's param's value: none for a flag
function valueOf(dialog: LinkedDialog): string | undefined {
    switch (dialog.kind) {
        case "profile":
            return dialog.section;
        case "achievements":
            return dialog.highlight === undefined ? EARN : `${EARN}:${dialog.highlight}`;
        case "streak_insurance":
            return INSURANCE;
        case "claim_history":
            return CALENDAR;
        case "share":
            return JSON.stringify({ title: dialog.title, text: dialog.text, url: dialog.url });
        case "puzzle": {
            const view = dialog.how ? HOW_TO : PUZZLE;
            return dialog.gameId === undefined ? view : `${view}:${dialog.gameId}`;
        }
        default:
            return undefined;
    }
}

/**
 * The linked dialog to show for the one the URL opens: none for the CHIT dialog (or its views) while CHIT is off
 * (a link to ?chit, the old UI's prize-message link …), however it was opened.
 */
export function shownLinkedDialog(
    dialog: LinkedDialog | undefined,
    chitOff: boolean,
): LinkedDialog | undefined {
    const chit =
        dialog?.kind === "chit" ||
        dialog?.kind === "achievements" ||
        dialog?.kind === "streak_insurance" ||
        dialog?.kind === "puzzle" ||
        dialog?.kind === "claim_history";
    return chit && chitOff ? undefined : dialog;
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
    if (showing?.kind === dialog.kind && valueOf(showing) === valueOf(dialog)) return undefined;
    const rest = new URLSearchParams(query);
    PARAM_ORDER.forEach((p) => rest.delete(p));
    // a flag, as withQueryStringFlag writes it, has no "=" (a section or a view is the value)
    const others = rest.toString();
    const value = valueOf(dialog);
    const param = `${encodeURIComponent(PARAMS[dialog.kind])}${value === undefined ? "" : `=${encodeURIComponent(value)}`}`;
    return `?${others === "" ? "" : `${others}&`}${param}`;
}

/** The screens of the dialogs built so far, to load ahead of their first opening. */
export function builtDialogScreens(): (() => Promise<{ default: Component<never> }>)[] {
    return Object.values(dialogs).filter((load) => load !== undefined);
}
