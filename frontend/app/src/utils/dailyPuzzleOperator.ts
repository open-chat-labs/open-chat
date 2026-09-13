import type { DailyPuzzleConfig, GameConfig, PuzzleParams } from "@client";

/**
 * Pure form <-> config conversions for the daily puzzle operator tab. The forms hold strings
 * (what an Input binds to); the canister types hold numbers. Every field of every config is
 * carried both ways, so a save sends what the operator sees and an unedited field keeps its
 * current value rather than falling back to a default (#9334 invariant 52).
 */

export type DailyPuzzleConfigForm = {
    enabled: boolean;
    entryFee: string;
    firstPlayFree: boolean;
    rewardByStreak: string;
    hintPenalty: string;
    minCardedSolveMs: string;
    maxSubmits: string;
    maxFreeChecks: string;
};

export type GameConfigForm = {
    hintPrices: string;
    maxHints: string;
};

export type PuzzleParamsForm = {
    gameId: string;
    width: string;
    height: string;
    tier: string;
    blackPct: string;
};

export const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
] as const;

function numberList(csv: string): number[] {
    return csv
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
        .map(Number);
}

export function configToForm(config: DailyPuzzleConfig): DailyPuzzleConfigForm {
    return {
        enabled: config.enabled,
        entryFee: config.entryFee.toString(),
        firstPlayFree: config.firstPlayFree,
        rewardByStreak: config.rewardByStreak.join(", "),
        hintPenalty: config.hintPenalty.toString(),
        minCardedSolveMs: config.minCardedSolveMs.toString(),
        maxSubmits: config.maxSubmits.toString(),
        maxFreeChecks: config.maxFreeChecks.toString(),
    };
}

export function formToConfig(form: DailyPuzzleConfigForm): DailyPuzzleConfig {
    return {
        enabled: form.enabled,
        entryFee: Number(form.entryFee),
        firstPlayFree: form.firstPlayFree,
        rewardByStreak: numberList(form.rewardByStreak),
        hintPenalty: Number(form.hintPenalty),
        minCardedSolveMs: BigInt(form.minCardedSolveMs),
        maxSubmits: Number(form.maxSubmits),
        maxFreeChecks: Number(form.maxFreeChecks),
    };
}

export function gameConfigToForm(config: GameConfig): GameConfigForm {
    return {
        hintPrices: config.hintPrices.join(", "),
        maxHints: config.maxHints.toString(),
    };
}

export function formToGameConfig(form: GameConfigForm): GameConfig {
    return {
        hintPrices: numberList(form.hintPrices),
        maxHints: Number(form.maxHints),
    };
}

export function scheduleToForm(schedule: PuzzleParams[]): PuzzleParamsForm[] {
    return schedule.map((p) => ({
        gameId: p.gameId,
        width: p.width.toString(),
        height: p.height.toString(),
        tier: p.tier.toString(),
        blackPct: p.blackPct.toString(),
    }));
}

export function formToSchedule(form: PuzzleParamsForm[]): PuzzleParams[] {
    return form.map((p) => ({
        gameId: p.gameId,
        width: Number(p.width),
        height: Number(p.height),
        tier: Number(p.tier),
        blackPct: Number(p.blackPct),
    }));
}

export type RegenerateOption = { value: string; label: string };

/**
 * What "Regenerate today" may be asked for: as scheduled, or one of the games the canister
 * reports a config for. Nothing else is offered (#9334 invariant 54).
 */
export function regenerateOptions(gameConfigs: [string, GameConfig][]): RegenerateOption[] {
    return [
        { value: "", label: "As scheduled" },
        ...gameConfigs.map(([gameId]) => ({ value: gameId, label: gameId })),
    ];
}
