import type {
    DailyPuzzleFetchResult,
    DailyPuzzleHintResponse,
    DailyPuzzleResult,
    DailyPuzzleSolved,
    DailyPuzzleStartResponse,
    DailyPuzzleSubmitResponse,
    DailyPuzzleUserState,
    PublicDailyPuzzle,
    PuzzleHint,
    ServedHint,
} from "@shared";
import type { OCError } from "@shared";
import { consolidateBytes, mapOptional, principalBytesToString } from "../../utils/mapping";
import { mapResult } from "../common/chatMappersV2";
import type {
    DailyPuzzleCurrentPuzzlesResponse,
    DailyPuzzleResult as TDailyPuzzleResult,
    DailyPuzzleResultsResponse,
    DailyPuzzleSolved as TDailyPuzzleSolved,
    DailyPuzzleUserState as TDailyPuzzleUserState,
    LocalUserIndexDailyPuzzleFetchResponse,
    LocalUserIndexDailyPuzzleHintResponse,
    LocalUserIndexDailyPuzzleStartResponse,
    LocalUserIndexDailyPuzzleSubmitResponse,
    PublicDailyPuzzle as TPublicDailyPuzzle,
    PuzzleHint as TPuzzleHint,
    ServedHint as TServedHint,
} from "./typebox";

export function publicDailyPuzzle(value: TPublicDailyPuzzle): PublicDailyPuzzle {
    return {
        gameId: value.game_id,
        number: value.number,
        tier: value.tier,
        description: consolidateBytes(value.description),
        startsAt: value.starts_at,
        expiresAt: value.expires_at,
        enabled: value.enabled,
        entryFee: value.entry_fee,
        firstPlayFree: value.first_play_free,
        hintPrices: value.hint_prices,
        maxHints: value.max_hints,
        minCardedSolveMs: value.min_carded_solve_ms,
    };
}

export function puzzleHint(value: TPuzzleHint): PuzzleHint {
    return {
        technique: value.technique,
        focus: value.focus,
        target: value.target,
        conclusions: value.conclusions.map(([k, v]) => [k, v]),
    };
}

export function servedHint(value: TServedHint): ServedHint {
    return {
        hint: puzzleHint(value.hint),
        level: value.level,
        mistake: value.mistake,
    };
}

export function dailyPuzzleSolved(value: TDailyPuzzleSolved): DailyPuzzleSolved {
    return {
        solvedAt: value.solved_at,
        solveTimeMs: value.solve_time_ms,
        reward: value.reward,
        hintsUsed: value.hints_used,
        streak: value.streak,
        chitBalance: mapOptional(value.chit_balance, (b) => b),
        totalChitEarned: mapOptional(value.total_chit_earned, (t) => t),
    };
}

export function dailyPuzzleUserState(value: TDailyPuzzleUserState): DailyPuzzleUserState {
    return {
        gameId: value.game_id,
        number: value.number,
        startedAt: mapOptional(value.started_at, (t) => t),
        hints: value.hints.map(servedHint),
        grid: consolidateBytes(value.grid),
        gridSavedAt: mapOptional(value.grid_saved_at, (t) => t),
        solved: mapOptional(value.solved, dailyPuzzleSolved),
        submits: value.submits,
        streak: value.streak,
        hasSolvedBefore: value.has_solved_before,
    };
}

export function dailyPuzzleResult(value: TDailyPuzzleResult): DailyPuzzleResult {
    return {
        gameId: value.game_id,
        number: value.number,
        userId: principalBytesToString(value.user_id),
        solveTimeMs: value.solve_time_ms,
        hintsUsed: value.hints_used,
        streak: value.streak,
        solvedAt: value.solved_at,
    };
}

export function dailyPuzzleFetchResponse(
    value: LocalUserIndexDailyPuzzleFetchResponse,
): DailyPuzzleFetchResult | OCError {
    return mapResult(value, (s) => ({
        puzzles: s.puzzles.map(publicDailyPuzzle),
        states: s.states.map(dailyPuzzleUserState),
    }));
}

export function dailyPuzzleStartResponse(
    value: LocalUserIndexDailyPuzzleStartResponse,
): DailyPuzzleStartResponse {
    return mapResult(value, (s) => ({
        kind: "success" as const,
        startedAt: s.started_at,
        state: dailyPuzzleUserState(s.state),
        chitBalance: mapOptional(s.chit_balance, (b) => b),
        totalChitEarned: mapOptional(s.total_chit_earned, (t) => t),
    }));
}

export function dailyPuzzleSubmitResponse(
    value: LocalUserIndexDailyPuzzleSubmitResponse,
): DailyPuzzleSubmitResponse {
    return mapResult(value, (s) => ({ kind: "success" as const, solved: dailyPuzzleSolved(s) }));
}

export function dailyPuzzleHintResponse(
    value: LocalUserIndexDailyPuzzleHintResponse,
): DailyPuzzleHintResponse {
    return mapResult(value, (s) => ({
        kind: "success" as const,
        hint: servedHint(s.hint),
        hintsUsed: s.hints_used,
        state: dailyPuzzleUserState(s.state),
        chitBalance: mapOptional(s.chit_balance, (b) => b),
        totalChitEarned: mapOptional(s.total_chit_earned, (t) => t),
    }));
}

export function currentPuzzlesResponse(value: DailyPuzzleCurrentPuzzlesResponse): PublicDailyPuzzle[] {
    if ("Success" in value) {
        return value.Success.map(publicDailyPuzzle);
    }
    return [];
}

export function dailyPuzzleResultsResponse(value: DailyPuzzleResultsResponse): DailyPuzzleResult[] {
    if ("Success" in value) {
        return value.Success.map(dailyPuzzleResult);
    }
    return [];
}
