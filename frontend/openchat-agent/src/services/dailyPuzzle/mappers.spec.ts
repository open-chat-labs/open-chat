import {
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
    test("the start, hint and solved responses carry the balances when present, and none otherwise", () => {
        const balances = (r: { chitBalance?: number; totalChitEarned?: number }) => [
            r.chitBalance,
            r.totalChitEarned,
        ];
        const start = (chit_balance?: number, total_chit_earned?: number) => {
            const resp = dailyPuzzleStartResponse({
                Success: { started_at: BigInt(1), state, chit_balance, total_chit_earned },
            } as LocalUserIndexDailyPuzzleStartResponse);
            if (resp.kind !== "success") throw new Error("expected success");
            return resp;
        };
        const hint = (chit_balance?: number, total_chit_earned?: number) => {
            const resp = dailyPuzzleHintResponse({
                Success: {
                    hint: {
                        hint: { technique: 1, focus: [0, 1], target: [0], conclusions: [[0, 1]] },
                        level: 2,
                        mistake: false,
                    },
                    hints_used: 1,
                    state,
                    chit_balance,
                    total_chit_earned,
                },
            } as LocalUserIndexDailyPuzzleHintResponse);
            if (resp.kind !== "success") throw new Error("expected success");
            return resp;
        };

        expect(balances(start())).toEqual([undefined, undefined]);
        expect(balances(start(3000, 4100))).toEqual([3000, 4100]);
        expect(balances(hint())).toEqual([undefined, undefined]);
        expect(balances(hint(2900, 4100))).toEqual([2900, 4100]);
        expect(balances(dailyPuzzleSolved(solved))).toEqual([undefined, undefined]);
        const paid = dailyPuzzleSolved({ ...solved, chit_balance: 3150, total_chit_earned: 4350 });
        expect(balances(paid)).toEqual([3150, 4350]);
        expect(paid.reward).toBe(250);
    });
});

describe("daily puzzle operator config mappers", () => {
    // Every field off its default, so a dropped or reset one would show
    const config = {
        enabled: true,
        entry_fee: 123,
        first_play_free: false,
        reward_by_streak: [1, 2, 3],
        hint_penalty: 77,
        min_carded_solve_ms: BigInt(12_345),
        max_submits: 9,
        max_free_checks: 11,
    };

    test("series config maps without losing a field", () => {
        const expected = {
            enabled: true,
            entryFee: 123,
            firstPlayFree: false,
            rewardByStreak: [1, 2, 3],
            hintPenalty: 77,
            minCardedSolveMs: BigInt(12_345),
            maxSubmits: 9,
            maxFreeChecks: 11,
        };
        expect(dailyPuzzleConfig(config)).toEqual(expected);
        expect(dailyPuzzleConfigResponse({ Success: config })).toEqual(expected);
    });

    test("a refusal comes through as the error, not a value", () => {
        expect(dailyPuzzleConfigResponse({ Error: [100, "not an operator"] })).toMatchObject({
            kind: "error",
            code: 100,
        });
    });
});
