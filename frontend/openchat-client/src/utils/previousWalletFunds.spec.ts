import {
    ErrorCode,
    type FundsInPreviousWallet,
    type MoveFundsOutcome,
    type MoveFundsResult,
} from "@shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
    movePreviousWalletFunds,
    PREVIOUS_WALLETS_CHECK_INTERVAL,
    PREVIOUS_WALLETS_RETRY_INTERVAL,
    PREVIOUS_WALLETS_STUCK_RETRY_INTERVAL,
} from "./previousWalletFunds";

const USER = { userId: "current", previousUserIds: ["previous"] };
const NOW = 1_000_000_000;
const FUNDS: FundsInPreviousWallet[] = [{ previousUserId: "previous", ledger: "icp", balance: 5n }];
const MOVED: MoveFundsResult = { kind: "moved", amount: 4n, fee: 1n, blockIndex: 1n };
const FAILED: MoveFundsResult = {
    kind: "failed",
    error: { kind: "error", code: 258, message: "Old canister not yet uninstalled" },
};
// Eg. BIL, whose ledger refuses every transfer
const STUCK: MoveFundsResult = {
    kind: "failed",
    error: { kind: "error", code: ErrorCode.TransferFailed, message: "TemporarilyUnavailable" },
};
const failedWith = (code: number): MoveFundsResult => ({
    kind: "failed",
    error: { kind: "error", code, message: "" },
});

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

    test("a balance whose move failed with an error from the LocalUserIndex isn't tried again while it stays the same", async () => {
        result = STUCK;
        await run(NOW);

        // Checked again a day later rather than an hour, passing over the stuck balance
        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL)).toBeUndefined();
        expect(await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL)).toEqual([]);
        expect(move).toHaveBeenLastCalledWith([]);
        expect(await run(NOW + 2 * PREVIOUS_WALLETS_CHECK_INTERVAL)).toEqual([]);
        expect(move).toHaveBeenLastCalledWith([]);
    });

    test("a stuck balance which changes is tried again", async () => {
        result = STUCK;
        await run(NOW);

        const changed = [{ ...FUNDS[0], balance: 6n }];
        find = vi.fn(() => Promise.resolve(changed));
        result = MOVED;
        expect(await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL)).toEqual([
            { previousUserId: "previous", ledger: "icp", result: MOVED },
        ]);
        expect(move).toHaveBeenLastCalledWith(changed);
    });

    test("a stuck balance is tried again a week after it failed", async () => {
        result = STUCK;
        await run(NOW);
        await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL);
        expect(move).toHaveBeenLastCalledWith([]);

        await run(NOW + PREVIOUS_WALLETS_STUCK_RETRY_INTERVAL);
        expect(move).toHaveBeenLastCalledWith(FUNDS);

        // Failing again, it's stuck for another week
        await run(NOW + PREVIOUS_WALLETS_STUCK_RETRY_INTERVAL + PREVIOUS_WALLETS_CHECK_INTERVAL);
        expect(move).toHaveBeenLastCalledWith([]);
    });

    test("other balances are still moved while one is stuck", async () => {
        move = vi.fn((funds: FundsInPreviousWallet[]) =>
            Promise.resolve(
                funds.map(({ previousUserId, ledger }) => ({
                    previousUserId,
                    ledger,
                    result: ledger === "icp" ? STUCK : MOVED,
                })),
            ),
        );
        await run(NOW);

        const chat = { previousUserId: "previous", ledger: "chat", balance: 7n };
        find = vi.fn(() => Promise.resolve([...FUNDS, chat]));
        expect(await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL)).toEqual([
            { previousUserId: "previous", ledger: "chat", result: MOVED },
        ]);
        expect(move).toHaveBeenLastCalledWith([chat]);
    });

    test("a stuck balance which has gone is forgotten", async () => {
        result = STUCK;
        await run(NOW);

        find = vi.fn(() => Promise.resolve([]));
        await run(NOW + PREVIOUS_WALLETS_CHECK_INTERVAL);
        expect(localStorage.getItem("openchat_previous_wallets_stuck_current")).toBeNull();

        // So the same balance arriving again is tried
        find = vi.fn(() => Promise.resolve(FUNDS));
        await run(NOW + 2 * PREVIOUS_WALLETS_CHECK_INTERVAL);
        expect(move).toHaveBeenLastCalledWith(FUNDS);
    });

    test.each([
        ["the old canister was busy", ErrorCode.AlreadyInProgress],
        ["the LocalUserIndex was short of cycles", ErrorCode.CyclesBalanceTooLow],
        ["the LocalUserIndex hadn't loaded the tokens", ErrorCode.NotInitialized],
        ["the call failed on the client", ErrorCode.Unknown],
        ["the worker failed", -1],
    ])("a move which failed because %s is tried again an hour later", async (_, code) => {
        result = failedWith(code);
        await run(NOW);

        expect(await run(NOW + PREVIOUS_WALLETS_RETRY_INTERVAL)).toBeDefined();
        expect(move).toHaveBeenLastCalledWith(FUNDS);
    });

    test("a balance stuck by a clock which was ahead is tried again once the clock is right", async () => {
        result = STUCK;
        await run(NOW + 365 * PREVIOUS_WALLETS_CHECK_INTERVAL);

        await run(NOW);
        expect(move).toHaveBeenLastCalledWith(FUNDS);
    });

    test("stuck balances which can't be read are tried again", async () => {
        localStorage.setItem("openchat_previous_wallets_stuck_current", "not json");

        await run(NOW);
        expect(move).toHaveBeenLastCalledWith(FUNDS);
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
