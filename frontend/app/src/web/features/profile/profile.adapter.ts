import {
    AuthProvider,
    ONE_MB,
    type AccountLinkingCode,
    type BotClientConfigData,
    type ChitEvent,
    type LinkedAuthenticationPrincipal,
    type CommunitySummary,
    type Metrics,
    type MinutesOnline,
    type PublicProfile,
    type StorageStatus,
    type UserSummary,
} from "@client";
import type {
    ChatSettings,
    ClaimDay,
    ProfileCommunity,
    SigninMethod,
} from "@openchat/ui/src/features/components/ProfileDialog.svelte";
import type { RingtoneKey } from "@src/stores/video";

// ProfileDialog's props from the user's profile, metrics and settings.

/** An image as the dialog draws its avatar and cover: a CSS background. */
export function cssImage(url: string): string {
    return `url("${url}") center / cover no-repeat`;
}

export type ProfileImages = {
    avatarUrl: string;
    // the profile background, if the user has set one (the dialog has its own pattern otherwise)
    coverUrl: string | undefined;
};

// the user's CHIT as the client keeps it for them (chitStateStore), with a streak that has ended at 0
export type ProfileChit = { streak: number; balance: number };

/** `userId` is the current user's; their summary may still be a placeholder as they sign in. */
export function profileProps(
    userId: string,
    user: UserSummary,
    profile: PublicProfile,
    chit: ProfileChit,
    images: ProfileImages,
) {
    return {
        userId,
        handle: profile.username,
        name: profile.displayName ?? "",
        about: profile.bio,
        joined: Number(profile.created),
        streak: chit.streak,
        balance: chit.balance,
        isDiamond: user.diamondStatus !== "inactive",
        isVerified: user.isUniquePerson,
        avatar: cssImage(images.avatarUrl),
        cover: images.coverUrl === undefined ? undefined : cssImage(images.coverUrl),
    };
}

/** The stats pane. Engagement labels are the app's i18n keys. */
export function statsProps(metrics: Metrics, minutes: MinutesOnline) {
    return {
        onlineMinutes: minutes.minutesOnlineThisMonth,
        onlineMinutesPrev: minutes.minutesOnlineLastMonth,
        messageMix: [
            { label: "ui.statsDonut.types.text", count: metrics.textMessages },
            { label: "ui.statsDonut.types.image", count: metrics.imageMessages },
            { label: "ui.statsDonut.types.video", count: metrics.videoMessages },
            { label: "ui.statsDonut.types.audio", count: metrics.audioMessages },
            { label: "ui.statsDonut.types.file", count: metrics.fileMessages },
            { label: "ui.statsDonut.types.gif", count: metrics.giphyMessages },
            { label: "ui.statsDonut.types.poll", count: metrics.polls },
            { label: "ui.statsDonut.types.crypto", count: metrics.cryptoMessages },
        ],
        engagement: [
            { label: "stats.reactions", count: metrics.reactions },
            { label: "stats.replies", count: metrics.replies },
            { label: "stats.pollVotes", count: metrics.pollVotes },
            { label: "stats.deletedMessages", count: metrics.deletedMessages },
        ],
        reported: metrics.reportedMessages,
    };
}

// the design's ringtones are the app's, but for one name
const DESIGN_RINGTONES: Record<RingtoneKey, ChatSettings["ringtone"]> = {
    boring: "boring",
    pleasant: "pleasant",
    boomboom: "boomboom",
    garage: "twostep",
    siren: "siren",
};

export function ringtoneKeyOf(tone: ChatSettings["ringtone"]): RingtoneKey {
    return tone === "twostep" ? "garage" : tone;
}

function isRingtoneKey(name: string): name is RingtoneKey {
    return Object.hasOwn(DESIGN_RINGTONES, name);
}

// a name the app no longer has shows as the app's default
function designRingtoneOf(stored: string): ChatSettings["ringtone"] {
    return isRingtoneKey(stored) ? DESIGN_RINGTONES[stored] : "boring";
}

/** The settings the chats & calls pane shows, as the app keeps them. */
export type AppChatSettings = {
    enterSend: boolean;
    doubleClickReply: boolean;
    notificationsGranted: boolean;
    lowBandwidth: boolean;
    hideBlocked: boolean;
    cameraOn: boolean;
    micOn: boolean;
    speakerView: boolean;
    offensive: boolean;
    adult: boolean;
    underReview: boolean;
    // selectedRingtone, which may hold a name the app no longer has
    ringtone: string;
};

export function chatSettingsProps(s: AppChatSettings): ChatSettings {
    return {
        enterSends: s.enterSend,
        doubleClick: s.doubleClickReply,
        notifications: s.notificationsGranted,
        lowBandwidth: s.lowBandwidth,
        hideBlocked: s.hideBlocked,
        cameraOn: s.cameraOn,
        micOn: s.micOn,
        activeSpeaker: s.speakerView,
        offensive: s.offensive,
        adult: s.adult,
        underReview: s.underReview,
        ringtone: designRingtoneOf(s.ringtone),
    };
}

/**
 * The settings the dialog changed, against what the app has stored. A ringtone is compared with
 * the stored name, so picking the default replaces one the app no longer has.
 */
export function changedChatSettings(
    stored: AppChatSettings,
    next: ChatSettings,
): (keyof ChatSettings)[] {
    const shown = chatSettingsProps(stored);
    return (Object.keys(next) as (keyof ChatSettings)[]).filter((key) =>
        key === "ringtone"
            ? ringtoneKeyOf(next.ringtone) !== stored.ringtone
            : next[key] !== shown[key],
    );
}

export type ThemePref = "system" | "dark" | "light";

/** The theme the appearance pane shows: themeType, which may hold a name the design doesn't have. */
export function themePrefOf(stored: string): ThemePref {
    return stored === "dark" || stored === "light" ? stored : "system";
}

/** The communities pane: the user's communities, and the name they go by in each that has one. */
export function communitiesProps(
    communities: CommunitySummary[],
    avatarUrl: (community: CommunitySummary) => string,
): { communities: ProfileCommunity[]; communityNames: Record<string, string> } {
    const names: Record<string, string> = {};
    for (const c of communities) {
        if (c.membership.displayName !== undefined)
            names[c.id.communityId] = c.membership.displayName;
    }
    return {
        communities: communities.map((c) => ({
            id: c.id.communityId,
            name: c.name,
            avatar: cssImage(avatarUrl(c)),
        })),
        communityNames: names,
    };
}

/**
 * The name to set in a community, without the spaces around it: clearing it (no name, or a blank
 * one) sends none, removing it.
 */
export function memberDisplayNameOf(name: string | null): string | undefined {
    const trimmed = name?.trim() ?? "";
    return trimmed === "" ? undefined : trimmed;
}

/** The storage pane, in MB. A limit of 0 (no allowance without Diamond) stays 0. */
export function storageProps(storage: StorageStatus) {
    return {
        storageUsedMB: storage.bytesUsed / ONE_MB,
        storageLimitMB: storage.byteLimit / ONE_MB,
    };
}

/** The bot configuration pane's values. */
export function botConfigProps(config: BotClientConfigData) {
    return {
        icHost: config.icHost,
        storageIndex: config.openStorageIndexCanister,
        publicKey: config.ocPublicKey,
    };
}

// the sign-in methods the dialog has a place for; Ethereum, Solana and NFID have none (GAPS.md)
const SIGNIN_TYPES: Partial<Record<AuthProvider, SigninMethod["type"]>> = {
    [AuthProvider.PASSKEY]: "passkey",
    [AuthProvider.II]: "ii",
    [AuthProvider.EMAIL]: "email",
};

/**
 * The sign-in methods pane: the identities linked to the account. `name` is a method's name for a
 * type (a passkey is named by its provider where it has one).
 */
export function signinMethodsProps(
    linked: LinkedAuthenticationPrincipal[],
    name: (type: SigninMethod["type"]) => string,
): SigninMethod[] {
    return linked.flatMap((p) => {
        const type = SIGNIN_TYPES[p.provider];
        if (type === undefined) return [];
        return [
            {
                type,
                id: p.principal,
                title: (type === "passkey" ? p.passkeyProvider : undefined) ?? name(type),
                current: p.isCurrentIdentity,
            },
        ];
    });
}

/** A device-link code for the dialog: when it expires, in ms. */
export function linkCodeProps(code: AccountLinkingCode): { code: string; expiresAt: number } {
    return { code: code.value, expiresAt: Number(code.expiresAt) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// the user's time zone at a moment, in minutes east of UTC
type OffsetMinutes = (ms: number) => number;
const browserOffset: OffsetMinutes = (ms) => -new Date(ms).getTimezoneOffset();

/**
 * The user's own day `ms` falls on, as the CHIT calendar takes its days: that date's midnight in
 * UTC (the calendar lays out UTC dates, and the backend counts a streak in the user's time zone,
 * so its `today` and its claims both go by the user's date).
 */
export function calendarDay(ms: number, offsetMinutes: OffsetMinutes = browserOffset): number {
    return Math.floor((ms + offsetMinutes(ms) * 60_000) / DAY_MS) * DAY_MS;
}

/** Today's claim as the calendar shows it, from what claiming answered. */
export function claimedNow(
    now: number,
    streakDay: number,
    amount: number,
    offsetMinutes: OffsetMinutes = browserOffset,
): ClaimDay {
    const day = new Date(calendarDay(now, offsetMinutes)).toISOString().slice(0, 10);
    return { day, streakDay, amount, minute: Math.floor((now % DAY_MS) / 60_000) };
}

/**
 * The CHIT calendar's days from the user's CHIT events (any order): a daily claim, a claim
 * reinstated, or a day covered by streak insurance, each on the user's own day (calendarDay). Each
 * one's streak day follows from the days before it: one more than the day before, or 1 after a
 * gap. A reinstated claim is a kept day with nothing earned.
 */
export function claimDays(
    events: ChitEvent[],
    offsetMinutes: OffsetMinutes = browserOffset,
): ClaimDay[] {
    const days: ClaimDay[] = [];
    let last: { dayNumber: number; streakDay: number } | undefined;
    const sorted = [...events].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
    for (const { reason, timestamp, amount } of sorted) {
        const kind = reason.kind;
        if (
            kind !== "daily_claim" &&
            kind !== "daily_claim_reinstated" &&
            kind !== "streak_insurance_claim"
        ) {
            continue;
        }
        const ms = Number(timestamp);
        const dayNumber = calendarDay(ms, offsetMinutes) / DAY_MS;
        // one a day
        if (last?.dayNumber === dayNumber) continue;
        const streakDay = last?.dayNumber === dayNumber - 1 ? last.streakDay + 1 : 1;
        last = { dayNumber, streakDay };
        const day = new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
        if (kind === "streak_insurance_claim") {
            days.push({ day, streakDay, insured: true });
        } else if (kind === "daily_claim_reinstated") {
            days.push({ day, streakDay, amount: 0 });
        } else {
            days.push({ day, streakDay, amount, minute: Math.floor((ms % DAY_MS) / 60_000) });
        }
    }
    return days;
}
