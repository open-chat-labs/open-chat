import type {
    Achievement as AchievementItem,
    AchievementBand,
} from "@openchat/ui/src/features/components/AchievementsDialog.svelte";
import type ChitDialog from "@openchat/ui/src/features/components/ChitDialog.svelte";
import type LeaderboardDialog from "@openchat/ui/src/features/components/LeaderboardDialog.svelte";
import type NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
import type { ComponentProps } from "svelte";
import {
    STREAK_INSURANCE_MAX_DAYS,
    streakInsurancePrice,
    walletApprovalFee,
    CHIT_STREAK_MILESTONES,
    currentStreak,
    dailyChitAmount,
    dailyChitClaimable,
    formatTimeRemaining,
    type Achievement,
    type AchievementEntry,
    type ChitLeaderboardResponse,
    type ChitState,
    type ChitUserBalance,
    type StreakInsurance,
} from "@client";

// ChitDialog's and the rail's CHIT props from the user's CHIT, as the old desktop UI shows them: a
// streak that has ended is none; the rail offers today's claim only while the last sync is recent
// (stale CHIT could offer a claim the backend turns down), and the dialog, as the old CHIT modal
// does, whenever it's due (a claim already made just moves the countdown on). Neither while CHIT
// is off.

/** What the CHIT props are worked out from. */
export type ChitInputs = {
    chit: ChitState;
    // when the last sync finished (latestSuccessfulUpdatesLoop), ms
    lastSync: number;
    // the user has turned CHIT off (disableChit)
    disabled: boolean;
    now: number;
};

export type ChitDialogProps = Pick<
    ComponentProps<typeof ChitDialog>,
    | "streak"
    | "balance"
    | "earned"
    | "daily"
    | "claimable"
    | "milestones"
    | "countdown"
    | "insured"
    | "used"
>;

export type ChitRailProps = Pick<
    ComponentProps<typeof NavRail>,
    "chitShown" | "chitStreak" | "chitClaimable"
>;

/**
 * ChitDialog's props, but its puzzle, achievements and leaderboard (8d's other parts). Unknown
 * (undefined) until the first sync: till then the user's CHIT is a placeholder (no streak, a claim
 * due), which would offer a claim the user may have made.
 */
export function chitDialogProps(
    { chit, lastSync, disabled, now }: ChitInputs,
    insurance: StreakInsurance,
): ChitDialogProps | undefined {
    if (lastSync === 0) return undefined;
    const streak = currentStreak(chit, now);
    const claimedToday = chit.nextDailyChitClaim > now;
    return {
        streak,
        balance: chit.chitBalance,
        earned: chit.totalChitEarned,
        // what today's claim pays, or paid
        daily: dailyChitAmount(claimedToday ? Math.max(streak, 1) : streak + 1),
        claimable: !disabled && !claimedToday,
        milestones: CHIT_STREAK_MILESTONES,
        // until the next claim (none while one is due)
        countdown: claimedToday
            ? formatTimeRemaining(now, Number(chit.nextDailyChitClaim), true)
            : "",
        insured: insurance.daysInsured,
        used: insurance.daysMissed,
    };
}

/** The rail's CHIT button: hidden while CHIT is off, and once claimed if the user hides it then. */
export function chitRailProps(
    { chit, lastSync, disabled, now }: ChitInputs,
    hideOnceClaimed: boolean,
): ChitRailProps {
    const open = !disabled && dailyChitClaimable(chit.nextDailyChitClaim, now, lastSync);
    return {
        chitShown: !disabled && (open || !hideOnceClaimed),
        chitStreak: currentStreak(chit, now),
        chitClaimable: open,
    };
}

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

type Boards = ComponentProps<typeof LeaderboardDialog>["boards"];

// the most each board shows, as the old hall of fame did
const BOARD_SIZE = 10;

/**
 * LeaderboardDialog's boards, as the old hall of fame shows them: this month's, last month's and
 * all time's top 10, months in UTC (as the backend counts them) named by `monthName` (the client's
 * toMonthString, as the old hall of fame names them). The user's own
 * place is shown on a board they're on (the backend has nothing for anyone below its top lists).
 * Before the leaderboard has loaded (`result` undefined), the boards are there, empty.
 * `allTime` is the all-time board's label, translated.
 */
export function leaderboardBoards(
    result: ChitLeaderboardResponse | undefined,
    userId: string,
    now: number,
    monthName: (date: Date) => string,
    allTime: string,
): Boards {
    // the UTC month `monthsBack` before now's, named from its middle so no zone moves it
    const month = (monthsBack: number) => {
        const date = new Date(now);
        return monthName(
            new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 15)),
        );
    };
    const board = (label: string, balances: ChitUserBalance[] = []) => {
        const top = balances.slice(0, BOARD_SIZE);
        const place = top.findIndex((b) => b.userId === userId);
        return {
            label,
            rows: top.map((b): [string, number] => [b.username, b.balance]),
            ...(place < 0 ? {} : { you: { rank: place + 1, score: top[place].balance } }),
        };
    };
    return {
        thisMonth: board(month(0), result?.thisMonth),
        lastMonth: board(month(1), result?.lastMonth),
        allTime: board(allTime, result?.allTime),
    };
}

const CHAT_E8S = 100_000_000;

/**
 * StreakInsuranceDialog's `prices`: what each position of the user's cover costs, in CHAT. The
 * dialog prices a position by the cover held (bought less missed days used), the backend by the
 * days bought, so the positions are offset by the days used, and there are fewer of them as the
 * days bought can't pass 30: what the dialog shows is what's charged.
 */
export function streakInsuranceDialogPrices({ daysMissed }: StreakInsurance): number[] {
    return Array.from(
        { length: Math.max(STREAK_INSURANCE_MAX_DAYS - daysMissed, 0) },
        (_, position) => 2 ** (daysMissed + position),
    );
}

/**
 * The CHAT the dialog can spend, in CHAT: the balance less the fee for the approval the user makes
 * before the price is taken (the price itself is burned, with no fee), so a day it offers can be
 * paid. None for a balance not loaded, or a CHAT ledger not known.
 */
export function streakInsuranceBalance(balanceE8s: bigint, transferFee: bigint): number {
    const spendable = balanceE8s - walletApprovalFee(transferFee);
    return spendable > 0n ? Number(spendable) / CHAT_E8S : 0;
}

/**
 * What buying `requested` more days sends: the days, capped so cover bought never passes 30, and
 * their price worked out from the cover bought (streakInsuranceStore), never the dialog's figure.
 */
export function streakInsurancePurchase(
    { daysInsured }: StreakInsurance,
    requested: number,
): { days: number; price: bigint } {
    const days = Math.max(Math.min(requested, STREAK_INSURANCE_MAX_DAYS - daysInsured), 0);
    return { days, price: streakInsurancePrice(daysInsured, days) };
}
