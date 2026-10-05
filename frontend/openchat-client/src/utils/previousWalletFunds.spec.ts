import type { FundsInPreviousWallet, MoveFundsOutcome, MoveFundsResult } from "@shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
    movePreviousWalletFunds,
    PREVIOUS_WALLETS_CHECK_INTERVAL,
    PREVIOUS_WALLETS_RETRY_INTERVAL,
} from "./previousWalletFunds";

const USER = { userId: "current", previousUserIds: ["previous"] };
const NOW = 1_000_000_000;
const FUNDS: FundsInPreviousWallet[] = [{ previousUserId: "previous", ledger: "icp", balance: 5n }];
const MOVED: MoveFundsResult = { kind: "moved", amount: 4n, fee: 1n, blockIndex: 1n };
const FAILED: MoveFundsResult = {
    kind: "failed",
    error: { kind: "error", code: 258, message: "Old canister not yet uninstalled" },
};

describe("movePreviousWalletFunds", () => {
    let result: MoveFundsResult;
    let find: () => Promise<FundsInPreviousWallet[]>;
    let move: (funds: FundsInPreviousWallet[]) => Promise<MoveFundsOutcome[]>;

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        result = MOVED;
        find = vi.fn(() => Promise.resolve(FUNDS));
        move = vi.fn((funds: FundsInPreviousWallet[]) =>
            Promise.resolve(
                funds.map(({ previousUserId, ledger }) => ({ previousUserId, ledger, result })),
            ),
        );
    });

    const run = (now: number, user = USER) => movePreviousWalletFunds(user, find, move, now);

    test("moves the funds found in the previous wallets", async () => {
        expect(await run(NOW)).toEqual([
            { previousUserId: "previous", ledger: "icp", result: MOVED },
        ]);
        expect(move).toHaveBeenCalledWith(FUNDS);
    });

    test("does nothing for a user who has never been migrated", async () => {
        expect(await run(NOW, { userId: "current", previousUserIds: [] })).toBeUndefined();
        expect(await run(NOW, { userId: "current" } as typeof USER)).toBeUndefined();
        expect(find).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });

    test("checks again a day later", async () => {
        await run(NOW);

        expect(await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL - 1)).toBeUndefined();
        expect(await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL)).toBeDefined();
        expect(find).toHaveBeenCalledTimes(2);
    });

    test("checks again an hour later if a move failed", async () => {
        result = FAILED;
        await run(NOW);

        result = MOVED;
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL - 1)).toBeUndefined();
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL)).toEqual([
            { previousUserId: "previous", ledger: "icp", result: MOVED },
        ]);
    });

    test("checks again a day later if nothing was found", async () => {
        find = vi.fn(() => Promise.resolve([]));
        expect(await run(NOW)).toEqual([]);

        expect(await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL - 1)).toBeUndefined();
        expect(await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL)).toEqual([]);
    });

    test("checks again an hour later if any of several moves failed", async () => {
        move = vi.fn(() =>
            Promise.resolve([
                { previousUserId: "previous", ledger: "icp", result: MOVED },
                { previousUserId: "previous", ledger: "chat", result: FAILED },
            ]),
        );
        await run(NOW);

        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL - 1)).toBeUndefined();
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL)).toBeDefined();
    });

    // Eg. while offline, rather than counting it as a check which found nothing
    test("checks again an hour later if the wallets couldn't be checked", async () => {
        find = vi.fn(() => Promise.reject(new Error("Offline")));
        expect(await run(NOW)).toBeUndefined();
        expect(move).not.toHaveBeenCalled();

        find = vi.fn(() => Promise.resolve(FUNDS));
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL - 1)).toBeUndefined();
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL)).toBeDefined();
    });

    test("a check put off by a clock which was ahead is due once the clock is right", async () => {
        await run(NOW + 365 * PREVIOUS_WALLETS_CHECK_INTERVAL);

        expect(await run(NOW)).toBeDefined();
    });

    test("a check made while another is in progress, eg. in another tab, is skipped", async () => {
        const first = run(NOW);

        expect(await run(NOW + 1)).toBeUndefined();
        expect(await first).toBeDefined();
        expect(find).toHaveBeenCalledOnce();
    });

    test("a check cut short is tried again an hour later", async () => {
        find = vi.fn(() => new Promise<FundsInPreviousWallet[]>(() => {}));
        void run(NOW);

        find = vi.fn(() => Promise.resolve(FUNDS));
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL - 1)).toBeUndefined();
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL)).toBeDefined();
    });

    test("each user is checked separately", async () => {
        await run(NOW);

        expect(
            await run(NOW, { userId: "other", previousUserIds: ["other_previous"] }),
        ).toBeDefined();
    });

    test("without storage, the wallets are checked every time", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("Storage disabled");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("Storage disabled");
        });

        expect(await run(NOW)).toBeDefined();
        expect(await run(NOW)).toBeDefined();
    });
});
