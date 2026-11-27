import { type Achievement, type AchievementEntry, type ChitEvent } from "@client";

// The ways to earn CHIT (the achievements), as the web's AchievementsDialog and the native CHIT
// screen's Achievements card and screen show them. Moved from the web's CHIT adapter (N11).

/** What AchievementsDialog's "next up" picks from: a quick win, a middling task or a big one. */
export type AchievementBand = "quick" | "mid" | "big";

/** An achievement as AchievementsDialog (its `Achievement`) and the native Achievements screen list it. */
export type AchievementItem = {
    id: string;
    /** One of AchievementsDialog's groups (its ACHIEVEMENT_GROUPS' keys). */
    group: string;
    reward: number;
    done: boolean;
    band: AchievementBand;
    label: string;
};

// AchievementsDialog's groups, for each achievement; the partners' (external) ones are "partners"
type AchievementGroup = "messaging" | "profile" | "wallet" | "community" | "streaks" | "referrals";
const GROUPS: Record<Achievement, AchievementGroup> = {
    sent_text: "messaging",
    reacted_to_message: "messaging",
    sent_direct_message: "messaging",
    received_direct_message: "messaging",
    edited_message: "messaging",
    deleted_message: "messaging",
    forwarded_message: "messaging",
    tipped_message: "messaging",
    sent_image: "messaging",
    sent_file: "messaging",
    sent_poll: "messaging",
    sent_video: "messaging",
    sent_audio: "messaging",
    sent_giphy: "messaging",
    sent_meme: "messaging",
    quote_replied: "messaging",
    replied_in_thread: "messaging",
    received_reaction: "messaging",
    had_message_tipped: "messaging",
    voted_on_poll: "messaging",
    sent_reminder: "messaging",
    followed_thread: "messaging",
    set_bio: "profile",
    set_avatar: "profile",
    set_display_name: "profile",
    set_community_display_name: "profile",
    changed_theme: "profile",
    set_pin: "profile",
    upgraded_to_diamond: "profile",
    upgrade_to_gold_diamond: "profile",
    proved_unique_personhood: "profile",
    sent_crypto: "wallet",
    received_crypto: "wallet",
    swapped_from_wallet: "wallet",
    sent_swap_offer: "wallet",
    accepted_swap_offer: "wallet",
    sent_prize: "wallet",
    deposited_btc: "wallet",
    joined_group: "community",
    joined_community: "community",
    started_call: "community",
    joined_call: "community",
    favourited_chat: "community",
    pinned_chat: "community",
    streak_3: "streaks",
    streak_7: "streaks",
    streak_14: "streaks",
    streak_30: "streaks",
    streak_100: "streaks",
    streak_365: "streaks",
    referred_1st_user: "referrals",
    referred_3rd_user: "referrals",
    referred_10th_user: "referrals",
    referred_20th_user: "referrals",
    referred_50th_user: "referrals",
};

// what the dialog's "next up" picks from: a quick win, a middling task or a big one, by reward
function bandOf(reward: number): AchievementBand {
    return reward <= 1000 ? "quick" : reward <= 3000 ? "mid" : "big";
}

/** An achievement's id in the dialog (and to pick it out): its own, or an external one's name. */
export function achievementItemId(entry: AchievementEntry): string {
    return entry.kind === "internal" ? entry.id : entry.achievement.name;
}

/**
 * AchievementsDialog's achievements, from the list to show (achievementList), each named by
 * `name` (the old UI's text for it, translated: the dialog takes text, not the app's keys).
 */
export function achievementItems(
    entries: AchievementEntry[],
    name: (achievement: Achievement) => string,
): AchievementItem[] {
    return entries.map((entry) => ({
        id: achievementItemId(entry),
        group: entry.kind === "internal" ? GROUPS[entry.id] : "partners",
        reward: entry.reward,
        done: entry.done,
        band: bandOf(entry.reward),
        // the old UI's name for it, or the partner's
        label: entry.kind === "internal" ? name(entry.id) : entry.achievement.name,
    }));
}

/** ChitDialog's "Ways to earn" count. */
export function achievementsCount(entries: AchievementEntry[]): { total: number; left: number } {
    return { total: entries.length, left: entries.filter((e) => !e.done).length };
}

/** The group (AchievementsDialog's) an earned achievement is in: its own, or "partners" for a partner's. */
export function earnedAchievementGroup(earned: EarnedAchievement): string {
    return earned.kind === "internal" ? GROUPS[earned.id] : "partners";
}

/** An achievement the user has earned, from their CHIT events: what it paid, and when (ms). */
export type EarnedAchievement =
    | { kind: "internal"; id: Achievement; amount: number; at: number }
    | { kind: "external"; name: string; amount: number; at: number };

/**
 * The achievements the user earned most recently, newest first, at most `count` (the native CHIT
 * screen's Achievements card shows 4), from their CHIT events (any order, as ClaimHistory loads
 * them). An achievement seen twice shows once.
 */
export function latestAchievements(
    events: readonly ChitEvent[],
    count: number,
): EarnedAchievement[] {
    const seen = new Set<string>();
    const earned: EarnedAchievement[] = [];
    const newestFirst = [...events].sort((a, b) =>
        a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0,
    );
    for (const { reason, amount, timestamp } of newestFirst) {
        if (earned.length >= count) break;
        const at = Number(timestamp);
        if (reason.kind === "achievement_unlocked" && !seen.has(reason.type)) {
            seen.add(reason.type);
            earned.push({ kind: "internal", id: reason.type, amount, at });
        } else if (reason.kind === "external_achievement_unlocked" && !seen.has(reason.name)) {
            seen.add(reason.name);
            earned.push({ kind: "external", name: reason.name, amount, at });
        }
    }
    return earned;
}
