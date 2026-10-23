import type { Achievement, ChitEvent, ExternalAchievement } from "@shared";

// The achievements a user can earn CHIT for, as the old "Learn to earn" lists them, and what each
// pays.

// what each achievement pays: the backend's table (`Achievement::chit_reward` in
// backend/libraries/types/src/achievement.rs), by the frontend's ids
const REWARDS: Record<Achievement, number> = {
    joined_group: 500,
    joined_community: 500,
    sent_direct_message: 700,
    received_direct_message: 1000,
    set_avatar: 1000,
    set_bio: 1000,
    set_display_name: 500,
    upgraded_to_diamond: 5000,
    upgrade_to_gold_diamond: 15000,
    streak_3: 1000,
    streak_7: 3000,
    streak_14: 5000,
    streak_30: 10000,
    streak_100: 20000,
    streak_365: 50000,
    proved_unique_personhood: 10000,
    set_community_display_name: 700,
    changed_theme: 800,
    sent_crypto: 2000,
    received_crypto: 3000,
    reacted_to_message: 400,
    received_reaction: 800,
    tipped_message: 1500,
    had_message_tipped: 2500,
    swapped_from_wallet: 3000,
    sent_swap_offer: 1000,
    accepted_swap_offer: 4000,
    sent_text: 700,
    sent_poll: 1000,
    voted_on_poll: 1000,
    sent_image: 1000,
    sent_video: 1000,
    sent_audio: 1000,
    sent_file: 1000,
    sent_giphy: 1000,
    sent_prize: 3000,
    sent_meme: 2000,
    sent_reminder: 1500,
    started_call: 2000,
    joined_call: 3000,
    replied_in_thread: 1500,
    quote_replied: 1500,
    edited_message: 1000,
    deleted_message: 700,
    set_pin: 1500,
    forwarded_message: 2000,
    favourited_chat: 2000,
    pinned_chat: 2000,
    followed_thread: 3000,
    referred_1st_user: 5000,
    referred_3rd_user: 10000,
    referred_10th_user: 20000,
    referred_20th_user: 30000,
    referred_50th_user: 50000,
    deposited_btc: 4000,
};

/** What an achievement pays in CHIT, as the backend pays it. */
export function achievementReward(achievement: Achievement): number {
    return REWARDS[achievement];
}

// the ones offered to earn (others count only once earned): the old "Learn to earn" list
const OFFERED = new Set<Achievement>([
    "streak_3",
    "streak_7",
    "streak_14",
    "streak_30",
    "streak_100",
    "streak_365",
    "set_bio",
    "set_avatar",
    "joined_group",
    "joined_community",
    "sent_direct_message",
    "received_direct_message",
    "upgraded_to_diamond",
    "set_display_name",
    "sent_text",
    "reacted_to_message",
    "sent_file",
    "sent_image",
    "sent_poll",
    "sent_crypto",
    "sent_video",
    "sent_audio",
    "sent_giphy",
    "sent_prize",
    "sent_meme",
    "sent_swap_offer",
    "quote_replied",
    "replied_in_thread",
    "edited_message",
    "deleted_message",
    "tipped_message",
    "forwarded_message",
    "received_crypto",
    "received_reaction",
    "had_message_tipped",
    "voted_on_poll",
    "sent_reminder",
    "set_community_display_name",
    "joined_call",
    "set_pin",
    "favourited_chat",
    "pinned_chat",
    "followed_thread",
    "swapped_from_wallet",
    "accepted_swap_offer",
    "referred_1st_user",
    "referred_3rd_user",
    "referred_10th_user",
    "referred_20th_user",
    "referred_50th_user",
    "upgrade_to_gold_diamond",
]);

/** One of the achievements the user can earn, or has. */
export type AchievementEntry =
    | { kind: "internal"; id: Achievement; reward: number; done: boolean }
    | { kind: "external"; id: number; name: string; url: string; reward: number; done: boolean };

/**
 * The achievements to show, as the old "Learn to earn" lists them: the offered ones and any
 * other already earned (`earned` holds the earned ones' ids, and external ones' names), then the
 * external ones, earned or still open (not past `expires` and with budget left), the best paying
 * first. `now` is ms.
 */
export function achievementList(
    all: readonly Achievement[],
    earned: ReadonlySet<string>,
    external: ExternalAchievement[],
    now: number,
): AchievementEntry[] {
    const internal = all
        .filter((a) => OFFERED.has(a) || earned.has(a))
        .map(
            (id): AchievementEntry => ({
                kind: "internal",
                id,
                reward: REWARDS[id],
                done: earned.has(id),
            }),
        );
    const others = [...external]
        .sort((a, b) => b.chitReward - a.chitReward)
        .filter((a) => earned.has(a.name) || (!a.budgetExhausted && BigInt(now) < a.expires))
        .map(
            (a): AchievementEntry => ({
                kind: "external",
                id: a.id,
                name: a.name,
                url: a.url,
                reward: a.chitReward,
                done: earned.has(a.name),
            }),
        );
    return [...internal, ...others];
}

/** An achievement just earned, as the earned popup names it. */
export type EarnedAchievement =
    | { kind: "internal"; id: Achievement }
    | { kind: "external"; name: string };

/**
 * What the earned popup shows for CHIT just earned: the amount, the achievements earned, and
 * whether one of them is the longest streak (365 days), which the old popup celebrates longer.
 */
export function chitEarnedSummary(events: ChitEvent[]): {
    amount: number;
    achievements: EarnedAchievement[];
    maxStreak: boolean;
} {
    const achievements = events.flatMap(({ reason }): EarnedAchievement[] => {
        if (reason.kind === "achievement_unlocked") return [{ kind: "internal", id: reason.type }];
        if (reason.kind === "external_achievement_unlocked") {
            return [{ kind: "external", name: reason.name }];
        }
        return [];
    });
    return {
        amount: events.reduce((total, e) => total + e.amount, 0),
        achievements,
        maxStreak: achievements.some((a) => a.kind === "internal" && a.id === "streak_365"),
    };
}
