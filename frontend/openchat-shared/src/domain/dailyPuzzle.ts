import type { OCError } from "./error";

export const LIGHT_UP_GAME_ID = "light_up";

export type PuzzleHint = {
    technique: number;
    /** Every key the deduction looked at; a superset of `target`, painted faintly as context. */
    focus: number[];
    /** The keys the sentence points at ("this cell"); painted strongly. Empty = all of focus. */
    target: number[];
    conclusions: [number, number][];
};

export type PublicDailyPuzzle = {
    gameId: string;
    number: number;
    tier: number;
    description: Uint8Array;
    startsAt: bigint;
    expiresAt: bigint;
    enabled: boolean;
    entryFee: number;
    firstPlayFree: boolean;
    hintPrices: number[];
    maxHints: number;
    minCardedSolveMs: bigint;
};

export type ServedHint = {
    hint: PuzzleHint;
    level: number;
    mistake: boolean;
};

export type DailyPuzzleSolved = {
    solvedAt: bigint;
    solveTimeMs: bigint;
    reward: number;
    hintsUsed: number;
    streak: number;
    /**
     * The user canister's balances after the reward was credited. Only present on the submit
     * response, and only when the credit landed in that call; absent on stored copies.
     */
    chitBalance?: number;
    totalChitEarned?: number;
};

export type DailyPuzzleUserState = {
    gameId: string;
    number: number;
    startedAt?: bigint;
    hints: ServedHint[];
    grid: Uint8Array;
    gridSavedAt?: bigint;
    solved?: DailyPuzzleSolved;
    submits: number;
    streak: number;
    hasSolvedBefore: boolean;
};

export type DailyPuzzleResult = {
    gameId: string;
    number: number;
    userId: string;
    solveTimeMs: bigint;
    hintsUsed: number;
    streak: number;
    solvedAt: bigint;
};

/** Today's puzzles (one per game on the rota) and one user state per puzzle. */
export type DailyPuzzleFetchResult = {
    puzzles: PublicDailyPuzzle[];
    states: DailyPuzzleUserState[];
};

export type DailyPuzzleStartSuccess = {
    kind: "success";
    startedAt: bigint;
    state: DailyPuzzleUserState;
    /** The user canister's balances after the entry fee; absent when nothing was debited. */
    chitBalance?: number;
    totalChitEarned?: number;
};
export type DailyPuzzleStartResponse = DailyPuzzleStartSuccess | OCError;

export type DailyPuzzleSubmitSuccess = { kind: "success"; solved: DailyPuzzleSolved };
export type DailyPuzzleSubmitResponse = DailyPuzzleSubmitSuccess | OCError;

export type DailyPuzzleHintSuccess = {
    kind: "success";
    hint: ServedHint;
    hintsUsed: number;
    state: DailyPuzzleUserState;
    /** The user canister's balances after the hint price; absent when nothing was debited. */
    chitBalance?: number;
    totalChitEarned?: number;
};
export type DailyPuzzleHintResponse = DailyPuzzleHintSuccess | OCError;

export type DailyPuzzleState = {
    puzzles: PublicDailyPuzzle[];
    states: DailyPuzzleUserState[];
    lastFetched?: number;
};

export const emptyDailyPuzzleState: DailyPuzzleState = { puzzles: [], states: [] };

/** The puzzle for `gameId`, or with no id the first enabled puzzle of the day. */
export function todaysPuzzle(
    state: DailyPuzzleState,
    gameId?: string,
): PublicDailyPuzzle | undefined {
    return gameId === undefined
        ? state.puzzles.find((p) => p.enabled)
        : state.puzzles.find((p) => p.gameId === gameId);
}

export function stateFor(state: DailyPuzzleState, gameId: string): DailyPuzzleUserState | undefined {
    return state.states.find((s) => s.gameId === gameId);
}

/** `state` with the user state for `next.gameId` replaced (or appended). */
export function withUserState(state: DailyPuzzleState, next: DailyPuzzleUserState): DailyPuzzleState {
    const found = state.states.some((s) => s.gameId === next.gameId);
    return {
        ...state,
        states: found
            ? state.states.map((s) => (s.gameId === next.gameId ? next : s))
            : [...state.states, next],
    };
}

export type DailyPuzzleChitKind = "entry" | "solve" | "hint";

export type DailyPuzzleChitKey = {
    gameId: string;
    number: number;
    /** FNV-1a 32-bit of the puzzle description as 8 hex chars; absent on keys minted before it was added. */
    fingerprint?: string;
    kind: DailyPuzzleChitKind;
};

function isChitKind(s: string | undefined): s is DailyPuzzleChitKind {
    return s === "entry" || s === "solve" || s === "hint";
}

/**
 * Chit event keys are `"{game_id}:{number}:{fp}:entry|solve|hint[:step:level]"`. Keys minted
 * before the fingerprint segment was added have no `fp`, and still parse.
 */
export function parseDailyPuzzleChitKey(key: string): DailyPuzzleChitKey | undefined {
    const [gameId, number, third, fourth] = key.split(":");
    if (gameId === undefined || number === undefined) return undefined;
    const n = Number(number);
    if (!Number.isInteger(n)) return undefined;
    if (isChitKind(third)) return { gameId, number: n, kind: third };
    if (third !== undefined && isChitKind(fourth)) {
        return { gameId, number: n, fingerprint: third, kind: fourth };
    }
    return undefined;
}

/** Result cards carry the puzzle layout as hex so they render without fetching the puzzle. */
export function descriptionToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Identifies the exact puzzle a saved grid belongs to: game id, number and an FNV-1a 32-bit
 * hash of the description bytes. A regenerated puzzle with the same number gets a different
 * fingerprint, so a grid saved against the old layout is not resumed onto the new one.
 */
export function puzzleFingerprint(puzzle: {
    gameId: string;
    number: number;
    description: Uint8Array;
}): string {
    let h = 0x811c9dc5;
    for (const b of puzzle.description) {
        h ^= b;
        h = Math.imul(h, 0x01000193);
    }
    return `${puzzle.gameId}:${puzzle.number}:${(h >>> 0).toString(16)}`;
}

export function descriptionFromHex(hex: string): Uint8Array {
    const out = new Uint8Array(Math.floor(hex.length / 2));
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return out;
}

/** Puzzle number for a UTC timestamp in ms: the UTC day number. */
export function dailyPuzzleNumber(nowMs: number): number {
    return Math.floor(nowMs / 86_400_000);
}
