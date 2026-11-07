import {
    AuthProvider,
    formatFileSize,
    type DiamondMembershipStatus,
    type LinkedAuthenticationPrincipal,
} from "@client";
import type { PageAccent } from "@openchat/ui/src/pages/types";
import type { ThemePref } from "@src/logic/profile/appearance";
import type { NotificationSwitch } from "@src/logic/profile/notifications";
import type { UsernameStatus } from "@src/logic/profile/usernameCheck.svelte";
import type { SettingsPage } from "../../router/locations";
import { usernameNote, type FieldNote } from "../start/start.adapter";

// The You tab's data as the native kit takes it (native design notes §3.11): its Account and
// Settings lists, and what each settings page shows that's worked out rather than read. The words
// come in from the screen (`t`), translated, as the kit shows its rows' labels as they are.

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** What the You tab's lists open: Edit profile, Diamond, or a settings page. */
export type YouRowId = "edit_profile" | "diamond" | SettingsPage;

export type YouRow = { id: YouRowId; icon: string; label: string; value: string };

export type YouLists = { account: YouRow[]; settings: YouRow[] };

/** What the lists' values come from. */
export type YouListInputs = {
    diamond: DiamondMembershipStatus;
    chitOn: boolean;
    theme: ThemePref;
    accent: PageAccent;
    notifications: NotificationSwitch;
    /** What the user has stored on the backend, and their allowance (storageStore). */
    storage: { bytesUsed: number; byteLimit: number };
};

export function youLists(inputs: YouListInputs, t: Translate): YouLists {
    const off = t("native.you.off");
    return {
        account: [
            {
                id: "edit_profile",
                icon: "user",
                label: t("native.you.editProfile.title"),
                value: "",
            },
            {
                id: "diamond",
                icon: "diamond",
                label: t("native.you.diamond.row"),
                value: diamondValue(inputs.diamond, t),
            },
        ],
        settings: [
            { id: "chit", icon: "zap", label: "CHIT", value: inputs.chitOn ? "" : off },
            { id: "chats", icon: "chat", label: t("native.you.chats.title"), value: "" },
            {
                id: "communities",
                icon: "community",
                label: t("native.you.communities.title"),
                value: "",
            },
            {
                id: "appearance",
                icon: "eye",
                label: t("native.you.appearance.title"),
                value: `${t(`native.start.appearance.${inputs.theme}`)} · ${t(`native.start.appearance.accents.${inputs.accent}`)}`,
            },
            {
                id: "notifications",
                icon: "bell",
                label: t("native.you.notifications.title"),
                value: notificationsOff(inputs.notifications) ? off : "",
            },
            {
                id: "storage",
                icon: "disk",
                label: t("native.you.storage.title"),
                value: storageValue(inputs.storage, t),
            },
            { id: "bots", icon: "bot", label: t("native.you.bots.title"), value: "" },
            { id: "account", icon: "lock", label: t("native.you.account.title"), value: "" },
        ],
    };
}

/**
 * Whether the Notifications row says Off: web push blocked or switched off. Without web push (the
 * apps' WebViews, whose notifications are the phone's) it says nothing.
 */
function notificationsOff(notifications: NotificationSwitch): boolean {
    switch (notifications.kind) {
        case "unsupported":
            return false;
        case "blocked":
            return true;
        case "switch":
            return !notifications.on;
    }
}

/** The Diamond row's value: Lifetime, Active, or not a member. */
function diamondValue(status: DiamondMembershipStatus, t: Translate): string {
    switch (status.kind) {
        case "lifetime":
            return t("native.you.diamond.lifetime");
        case "active":
            return t("native.you.diamond.active");
        case "inactive":
            return t("native.you.diamond.none");
    }
}

/** The Storage row's value: what's used, of the allowance where there's one (Diamond's). */
function storageValue(storage: { bytesUsed: number; byteLimit: number }, t: Translate): string {
    const used = formatFileSize(storage.bytesUsed);
    return storage.byteLimit > 0
        ? t("native.you.storage.ofLimit", { used, limit: formatFileSize(storage.byteLimit) })
        : used;
}

/**
 * The Diamond screen's button: upgrading, or extending a membership that ends; none for a
 * lifetime one, or where Diamond can't be paid for (an app store build).
 */
export function diamondAction(
    status: DiamondMembershipStatus,
    paymentsOff: boolean,
): "upgrade" | "extend" | undefined {
    if (paymentsOff) return undefined;
    switch (status.kind) {
        case "lifetime":
            return undefined;
        case "active":
            return "extend";
        case "inactive":
            return "upgrade";
    }
}

/**
 * What Diamond gives, as the app's Diamond upgrade lists it (its `upgrade.*` strings): an icon, the
 * feature and Diamond's allowance. The prototype's list (1 GB uploads, 10 GB, unlimited groups,
 * translation) isn't what Diamond gives.
 */
export const DIAMOND_PERKS: readonly { icon: string; label: string; sub: string }[] = [
    { icon: "diamond", label: "upgrade.diamondBadge", sub: "native.you.diamond.badgeSub" },
    { icon: "disk", label: "upgrade.storage", sub: "upgrade.diamondStorage" },
    { icon: "image", label: "upgrade.mediaMessages", sub: "upgrade.diamondMediaMessages" },
    { icon: "chat", label: "upgrade.textMessages", sub: "upgrade.diamondTextMessages" },
    { icon: "users", label: "upgrade.publicGroups", sub: "upgrade.diamondPublicGroups" },
    {
        icon: "community",
        label: "upgrade.createCommunities",
        sub: "native.you.diamond.communitiesSub",
    },
    { icon: "lock", label: "upgrade.gatedGroups", sub: "native.you.diamond.gatedSub" },
];

/** Whether the user is a Diamond member (the pill by their name). */
export function isDiamond(status: DiamondMembershipStatus): boolean {
    return status.kind !== "inactive";
}

/** How much of the storage allowance is used, 0 to 1; none without an allowance. */
export function storageFraction(bytesUsed: number, byteLimit: number): number {
    return byteLimit > 0 ? Math.min(1, bytesUsed / byteLimit) : 0;
}

/**
 * The line under Edit profile's username: as sign-up's while it's being changed (the rules, then
 * whether the name is free), what it's for while it's the saved one, and why the backend turned it
 * down (`rejected`, an i18n key) after a save.
 */
export function profileUsernameNote(
    status: UsernameStatus,
    username: string,
    rejected: string | undefined,
): FieldNote {
    if (rejected !== undefined) return { key: rejected, tone: "warn" };
    return status === "unchanged"
        ? { key: "native.you.editProfile.usernameHint", tone: "hint" }
        : usernameNote(status, username);
}

/** The line under the display name: what it's for, or why it can't be saved. */
export function displayNameNote(valid: boolean, rejected: string | undefined): FieldNote {
    if (rejected !== undefined) return { key: rejected, tone: "warn" };
    return valid
        ? { key: "native.you.editProfile.nameHint", tone: "hint" }
        : { key: "native.you.editProfile.nameRules", tone: "warn" };
}

/** A sign-in method linked to the account, as Account lists it. */
export type SignInMethodRow = { id: string; label: string; value: string };

// each provider's name; a passkey is named by its provider where it has one (iCloud Keychain …)
const PROVIDER_NAMES: Record<AuthProvider, string> = {
    [AuthProvider.PASSKEY]: "native.you.account.passkey",
    [AuthProvider.II]: "native.you.account.ii",
    [AuthProvider.EMAIL]: "native.you.account.email",
    [AuthProvider.ETH]: "native.you.account.eth",
    [AuthProvider.SOL]: "native.you.account.sol",
    [AuthProvider.NFID]: "native.you.account.nfid",
};

/**
 * The sign-in methods linked to the account: the one this session signed in with says so, the
 * others when they were last used (`used`), where that's known.
 */
export function signInMethodRows(
    linked: LinkedAuthenticationPrincipal[],
    t: Translate,
    used: (lastUsed: bigint) => string,
): SignInMethodRow[] {
    return linked.map((p) => ({
        id: p.principal,
        label: p.passkeyProvider ?? t(PROVIDER_NAMES[p.provider]),
        value: p.isCurrentIdentity
            ? t("native.you.account.thisSession")
            : p.lastUsed !== undefined
              ? used(p.lastUsed)
              : "",
    }));
}
