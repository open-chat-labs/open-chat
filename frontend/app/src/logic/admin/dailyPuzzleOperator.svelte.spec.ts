import type { DailyPuzzleConfig, DailyPuzzleState, OCError, OpenChat, Success } from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    DailyPuzzleOperator,
    dailyPuzzleFailure,
    regeneratedMessage,
    type DailyPuzzleOutcome,
} from "./dailyPuzzleOperator.svelte";

type DailyPuzzleClient = Pick<
    OpenChat,
    | "dailyPuzzleConfig"
    | "dailyPuzzleSetEnabled"
    | "dailyPuzzleRegenerateToday"
    | "dailyPuzzleFetch"
>;

const config = (enabled: boolean) => ({ enabled }) as DailyPuzzleConfig;

function client(overrides: Partial<DailyPuzzleClient> = {}): DailyPuzzleClient {
    return {
        dailyPuzzleConfig: async () => config(true),
        dailyPuzzleSetEnabled: async (): Promise<Success | OCError> => ({ kind: "success" }),
        dailyPuzzleRegenerateToday: async (): Promise<Success | OCError> => ({ kind: "success" }),
        dailyPuzzleFetch: async () => ({}) as DailyPuzzleState,
        ...overrides,
    };
}

describe("dailyPuzzleFailure", () => {
    test("an error's message, else its code, else what was thrown", () => {
        expect(dailyPuzzleFailure("X", { kind: "error", code: 3, message: "nope" }).key).toBe(
            "X: nope",
        );
        expect(dailyPuzzleFailure("X", { kind: "error", code: 3, message: undefined }).key).toBe(
            "X: code 3",
        );
        expect(dailyPuzzleFailure("X", new Error("boom")).key).toBe("X: Error: boom");
    });
});

test("regeneratedMessage", () => {
    expect(regeneratedMessage(undefined)).toBe("Today's puzzle regenerated as scheduled");
    expect(regeneratedMessage("wordle")).toBe("Today's puzzle regenerated as wordle");
});

describe("DailyPuzzleOperator", () => {
    test("refresh shows what the canister holds", async () => {
        const puzzle = new DailyPuzzleOperator(client());
        expect(await puzzle.refresh()).toBeUndefined();
        expect(puzzle.enabled).toBe(true);
        expect(puzzle.config?.enabled).toBe(true);
    });

    test("a failed read comes back and is kept", async () => {
        const puzzle = new DailyPuzzleOperator(
            client({ dailyPuzzleConfig: async () => ({ kind: "error", code: 1, message: "no" }) }),
        );
        const outcome = await puzzle.refresh();
        expect(outcome?.message.key).toBe("Failed to read the daily puzzle config: no");
        expect(puzzle.error?.key).toBe("Failed to read the daily puzzle config: no");
    });

    test("saving reports success, reads the config back and refetches the puzzle", async () => {
        const setEnabled = vi.fn(async (): Promise<Success | OCError> => ({ kind: "success" }));
        const fetch = vi.fn(async () => ({}) as DailyPuzzleState);
        const puzzle = new DailyPuzzleOperator(
            client({
                dailyPuzzleSetEnabled: setEnabled,
                dailyPuzzleConfig: async () => config(false),
                dailyPuzzleFetch: fetch,
            }),
        );
        puzzle.enabled = false;
        const reports: DailyPuzzleOutcome[] = [];
        const saving = puzzle.saveEnabled((o) => reports.push(o));
        expect(puzzle.busy.has("enabled")).toBe(true);
        await saving;
        expect(puzzle.busy.has("enabled")).toBe(false);
        expect(setEnabled).toHaveBeenCalledWith(false);
        expect(reports.map((r) => r.message.key)).toEqual([
            "Daily puzzle disabled; pushed to every local user index",
        ]);
        expect(puzzle.config?.enabled).toBe(false);
        expect(fetch).toHaveBeenCalled();
    });

    test("regenerating as scheduled sends no game; a failure is reported", async () => {
        const regenerate = vi.fn(
            async (): Promise<Success | OCError> => ({
                kind: "error",
                code: 9,
                message: undefined,
            }),
        );
        const puzzle = new DailyPuzzleOperator(client({ dailyPuzzleRegenerateToday: regenerate }));
        const reports: DailyPuzzleOutcome[] = [];
        await puzzle.regenerateToday((o) => reports.push(o));
        expect(regenerate).toHaveBeenCalledWith(undefined);
        expect(reports).toEqual([
            {
                kind: "failed",
                message: expect.objectContaining({ key: "Regenerate failed: code 9" }),
            },
        ]);
        expect(puzzle.error?.key).toBe("Regenerate failed: code 9");
    });
});
