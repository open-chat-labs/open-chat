import {
    ONE_MB,
    type BotClientConfigData,
    type CommunitySummary,
    type Metrics,
    type MinutesOnline,
    type PublicProfile,
    type StorageStatus,
    type UserSummary,
} from "@client";
import type {
    ChatSettings,
    ProfileCommunity,
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
