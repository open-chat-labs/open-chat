import {
    apiDailyPuzzleConfig,
    dailyPuzzleConfig,
    dailyPuzzleConfigResponse,
    dailyPuzzleHintResponse,
    dailyPuzzleSolved,
    dailyPuzzleStartResponse,
} from "./mappers";
import type {
    DailyPuzzleSolved as TDailyPuzzleSolved,
    DailyPuzzleUserState as TDailyPuzzleUserState,
    LocalUserIndexDailyPuzzleHintResponse,
    LocalUserIndexDailyPuzzleStartResponse,
} from "./typebox";

const state: TDailyPuzzleUserState = {
    game_id: "light_up",
    number: 20705,
    started_at: BigInt(1),
    hints: [],
    grid: [],
    grid_saved_at: undefined,
    solved: undefined,
    submits: 0,
    free_checks: 2,
    streak: 0,
    has_solved_before: false,
    entry_fee: 0,
};

const solved: TDailyPuzzleSolved = {
    solved_at: BigInt(2),
    solve_time_ms: BigInt(1),
    reward: 250,
    hints_used: 0,
    streak: 1,
    chit_balance: undefined,
    total_chit_earned: undefined,
};

describe("daily puzzle mappers", () => {
    describe("balances carried on the responses", () => {
        test("start response without a debit carries no balance", () => {
            const resp = dailyPuzzleStartResponse({
                Success: {
                    started_at: BigInt(1),
                    state,
                    chit_balance: undefined,
                    total_chit_earned: undefined,
                },
            } as LocalUserIndexDailyPuzzleStartResponse);
            expect(resp.kind).toBe("success");
            if (resp.kind !== "success") return;
            expect(resp.chitBalance).toBeUndefined();
            expect(resp.totalChitEarned).toBeUndefined();
        });

        test("start response with a debit maps both balances", () => {
            const resp = dailyPuzzleStartResponse({
                Success: {
                    started_at: BigInt(1),
                    state,
                    chit_balance: 3000,
                    total_chit_earned: 4100,
                },
            } as LocalUserIndexDailyPuzzleStartResponse);
            if (resp.kind !== "success") throw new Error("expected success");
            expect(resp.chitBalance).toBe(3000);
            expect(resp.totalChitEarned).toBe(4100);
        });

        test("hint response maps balances when present", () => {
            const hint = {
                hint: { technique: 1, focus: [0, 1], target: [0], conclusions: [[0, 1]] },
                level: 2,
                mistake: false,
            };
            const withBalance = dailyPuzzleHintResponse({
                Success: {
                    hint,
                    hints_used: 1,
                    state,
                    chit_balance: 2900,
                    total_chit_earned: 4100,
                },
            } as LocalUserIndexDailyPuzzleHintResponse);
            if (withBalance.kind !== "success") throw new Error("expected success");
            expect(withBalance.chitBalance).toBe(2900);
            expect(withBalance.totalChitEarned).toBe(4100);

            const without = dailyPuzzleHintResponse({
                Success: {
                    hint,
                    hints_used: 1,
                    state,
                    chit_balance: undefined,
                    total_chit_earned: undefined,
                },
            } as LocalUserIndexDailyPuzzleHintResponse);
            if (without.kind !== "success") throw new Error("expected success");
            expect(without.chitBalance).toBeUndefined();
        });

        test("solved maps balances only when present", () => {
            expect(dailyPuzzleSolved(solved).chitBalance).toBeUndefined();
            expect(dailyPuzzleSolved(solved).totalChitEarned).toBeUndefined();
            const paid = dailyPuzzleSolved({
                ...solved,
                chit_balance: 3150,
                total_chit_earned: 4350,
            });
            expect(paid.chitBalance).toBe(3150);
            expect(paid.totalChitEarned).toBe(4350);
            expect(paid.reward).toBe(250);
        });
    });
});

describe("daily puzzle operator config mappers", () => {
    const config = {
        enabled: true,
        entryFee: 123,
        firstPlayFree: false,
        rewardByStreak: [1, 2, 3],
        hintPenalty: 77,
        minCardedSolveMs: BigInt(12_345),
        maxSubmits: 9,
        maxFreeChecks: 11,
    };

    test("series config maps both ways without losing a field", () => {
        expect(apiDailyPuzzleConfig(config)).toEqual({
            enabled: true,
            entry_fee: 123,
            first_play_free: false,
            reward_by_streak: [1, 2, 3],
            hint_penalty: 77,
            min_carded_solve_ms: BigInt(12_345),
            max_submits: 9,
            max_free_checks: 11,
        });
        expect(dailyPuzzleConfig(apiDailyPuzzleConfig(config))).toEqual(config);
        expect(dailyPuzzleConfigResponse({ Success: apiDailyPuzzleConfig(config) })).toEqual(
            config,
        );
    });

    test("a refusal comes through as the error, not a value", () => {
        expect(dailyPuzzleConfigResponse({ Error: [100, "not an operator"] })).toMatchObject({
            kind: "error",
            code: 100,
        });
    });
});
