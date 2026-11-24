import type ChitDialog from "@openchat/ui/src/features/components/ChitDialog.svelte";
import type LeaderboardDialog from "@openchat/ui/src/features/components/LeaderboardDialog.svelte";
import type NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
import { chitButton, type ChitButtonInputs } from "@src/logic/chit/chitButton";
import { dailyClaim } from "@src/logic/chit/dailyClaim";
import type { ComponentProps } from "svelte";
import {
    CHIT_STREAK_MILESTONES,
    streakRingProgress,
    type ChitLeaderboardResponse,
    type ChitUserBalance,
    type StreakInsurance,
} from "@client";

// ChitDialog's and the rail's CHIT props from the user's CHIT, as the old desktop UI shows them: a
// streak that has ended is none; the rail offers today's claim only while the last sync is recent
// (stale CHIT could offer a claim the backend turns down), and the dialog, as the old CHIT modal
// does, whenever it's due (a claim already made just moves the countdown on). Neither while CHIT
// is off.

/** What the CHIT props are worked out from. */
export type ChitInputs = ChitButtonInputs;

export type ChitDialogProps = Pick<
    ComponentProps<typeof ChitDialog>,
    | "streak"
    | "balance"
    | "earned"
    | "daily"
    | "claimable"
    | "claimedToday"
    | "milestones"
    | "progress"
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
    inputs: ChitInputs,
    insurance: StreakInsurance,
): ChitDialogProps | undefined {
    // today's claim (logic/chit/dailyClaim, as the native You tab's CHIT card)
    const claim = dailyClaim(inputs);
    if (claim === undefined) return undefined;
    return {
        streak: claim.streak,
        balance: claim.balance,
        earned: claim.earned,
        daily: claim.daily,
        claimable: claim.claimable,
        claimedToday: claim.claimedToday,
        milestones: CHIT_STREAK_MILESTONES,
        progress: streakRingProgress(claim.streak, claim.claimedToday, CHIT_STREAK_MILESTONES),
        countdown: claim.countdown,
        insured: insurance.daysInsured,
        used: insurance.daysMissed,
    };
}

/** The rail's CHIT button (logic/chit/chitButton, as the native Chats header's). */
export function chitRailProps(inputs: ChitInputs, hideOnceClaimed: boolean): ChitRailProps {
    const button = chitButton(inputs, hideOnceClaimed);
    return {
        chitShown: button.shown,
        chitStreak: button.streak,
        chitClaimable: button.claimable,
    };
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
