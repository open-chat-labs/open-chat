import { Principal } from "@icp-sdk/core/principal";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
    APPROVAL_VALIDITY_MS,
    approveFromExternalWallet,
    buildApproveArgs,
    missingScopes,
    SIGNER_WALLETS,
    SignerConnection,
    type ApproveSpendingArgs,
    type WalletAccount,
} from "./signer";

const walletOwner = Principal.selfAuthenticating(new Uint8Array(32).fill(7));
const spenderOwner = Principal.fromText("dfdal-2uaaa-aaaaa-qaama-cai");
const subaccount = new Uint8Array(32);
subaccount[31] = 5;

function args(overrides: Partial<ApproveSpendingArgs> = {}): ApproveSpendingArgs {
    return {
        account: { owner: walletOwner, address: walletOwner.toText() },
        ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
        amount: 100_000_000n,
        spender: { owner: spenderOwner },
        ...overrides,
    };
}

describe("buildApproveArgs", () => {
    test("leaves out the optional fields which are not set", () => {
        const approveArgs = buildApproveArgs(args(), 1_000);

        // The spender is the one field the ledger's candid reaches us unconverted, so it is the
        // one which still has to be opt encoded by hand
        expect(approveArgs).toEqual({
            from_subaccount: undefined,
            spender: { owner: spenderOwner, subaccount: [] },
            amount: 100_000_000n,
            expires_at: BigInt(1_000 + APPROVAL_VALIDITY_MS) * 1_000_000n,
        });
    });

    test("expires the approval by default, rather than leaving it standing", () => {
        expect(buildApproveArgs(args(), 1_000).expires_at).toEqual(
            BigInt(1_000 + APPROVAL_VALIDITY_MS) * 1_000_000n,
        );
        expect(APPROVAL_VALIDITY_MS).toEqual(10 * 60 * 1000);
    });

    test("includes subaccounts and expiry when set", () => {
        const approveArgs = buildApproveArgs(
            args({
                account: { owner: walletOwner, subaccount, address: "" },
                spender: { owner: spenderOwner, subaccount },
                expiresAt: 1_000_000n,
            }),
        );

        expect(approveArgs.from_subaccount).toEqual(subaccount);
        expect(approveArgs.spender.subaccount).toEqual([subaccount]);
        expect(approveArgs.expires_at).toEqual(1_000_000n);
    });
});

describe("approveFromExternalWallet", () => {
    const approval = {
        wallet: SIGNER_WALLETS[0],
        ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
        amount: 100_000_000n,
        spender: { owner: spenderOwner },
    };

    function account(n: number): WalletAccount {
        return { owner: walletOwner, address: `account-${n}` };
    }

    // Stands in for the wallet at the other end of the popup, so the flow around it can be
    // exercised without one
    function connection(accounts: WalletAccount[], approveSpending = vi.fn().mockResolvedValue(1n)) {
        const stub = {
            accounts: vi.fn().mockResolvedValue(accounts),
            approveSpending,
            disconnect: vi.fn().mockResolvedValue(undefined),
        };
        vi.spyOn(SignerConnection, "connect").mockResolvedValue(
            stub as unknown as SignerConnection,
        );
        return stub;
    }

    afterEach(() => vi.restoreAllMocks());

    test("a lone account is used without asking the user", async () => {
        const wallet = connection([account(1)]);
        const choose = vi.fn();

        await expect(approveFromExternalWallet(approval, "https://icp-api.io", choose)).resolves.toBe(
            "account-1",
        );
        expect(choose).not.toHaveBeenCalled();
        expect(wallet.approveSpending).toHaveBeenCalled();
    });

    test("the chosen account is the one approved, and the one paid from", async () => {
        const wallet = connection([account(1), account(2)]);
        const onApproving = vi.fn();

        await expect(
            approveFromExternalWallet(
                approval,
                "https://icp-api.io",
                (accounts) => Promise.resolve(accounts[1]),
                onApproving,
            ),
        ).resolves.toBe("account-2");
        expect(wallet.approveSpending).toHaveBeenCalledWith(
            expect.objectContaining({ account: account(2), amount: 100_000_000n }),
        );
        expect(onApproving).toHaveBeenCalled();
    });

    // Asking the user to choose from an empty list would leave the flow waiting on a choice they
    // cannot make, so there is nothing to pay from and the flow has to end
    test("a wallet which names no accounts fails rather than stranding the flow", async () => {
        const wallet = connection([]);
        const choose = vi.fn();

        await expect(
            approveFromExternalWallet(approval, "https://icp-api.io", choose),
        ).rejects.toThrow();
        expect(choose).not.toHaveBeenCalled();
        expect(wallet.approveSpending).not.toHaveBeenCalled();
    });

    // Backing out is also how the caller ends a choice which can no longer be made - closing the
    // dialog takes the chooser away with it - so it has to end the flow rather than leave the
    // wallet holding a popup open on a request nothing will answer
    test("backing out of the account choice approves nothing, and closes the popup", async () => {
        const wallet = connection([account(1), account(2)]);

        await expect(
            approveFromExternalWallet(approval, "https://icp-api.io", () =>
                Promise.resolve(undefined),
            ),
        ).resolves.toBeUndefined();
        expect(wallet.approveSpending).not.toHaveBeenCalled();
        expect(wallet.disconnect).toHaveBeenCalled();
    });

    test.each([
        ["the approval goes through", vi.fn().mockResolvedValue(1n)],
        ["the wallet refuses", vi.fn().mockRejectedValue(new Error("refused"))],
    ])("the popup closes when %s", async (_case, approveSpending) => {
        const wallet = connection([account(1)], approveSpending);

        await approveFromExternalWallet(approval, "https://icp-api.io", vi.fn()).catch(() => {});

        expect(wallet.disconnect).toHaveBeenCalled();
    });
});

describe("missingScopes", () => {
    const required = [{ method: "icrc27_accounts" }, { method: "icrc49_call_canister" }];

    test("nothing is missing when both are granted", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc27_accounts" }, state: "granted" },
                { scope: { method: "icrc49_call_canister" }, state: "granted" },
            ]),
        ).toEqual([]);
    });

    test("ask_on_use counts as granted", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc27_accounts" }, state: "ask_on_use" },
                { scope: { method: "icrc49_call_canister" }, state: "ask_on_use" },
            ]),
        ).toEqual([]);
    });

    test("a denied scope is missing", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc27_accounts" }, state: "denied" },
                { scope: { method: "icrc49_call_canister" }, state: "granted" },
            ]),
        ).toEqual(["icrc27_accounts"]);
    });

    // A wallet which grants nothing can answer with an empty list rather than denying each scope
    test("a scope left out of the response is missing", () => {
        expect(
            missingScopes(required, [
                { scope: { method: "icrc49_call_canister" }, state: "granted" },
            ]),
        ).toEqual(["icrc27_accounts"]);
        expect(missingScopes(required, [])).toEqual(["icrc27_accounts", "icrc49_call_canister"]);
    });
});
