import { Principal } from "@icp-sdk/core/principal";
import type { PendingCryptocurrencyTransfer } from "@shared";
import { encodeIcrcAccount } from "@shared";
import { describe, expect, test } from "vitest";
import {
    addressToIcrcAccount,
    apiPendingCryptoTransaction,
    formatIcrcAccount,
    pendingCryptoTransfer,
} from "./chatMappersV2";

const ledger = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const recipient = "dfdal-2uaaa-aaaaa-qaama-cai";
const walletOwner = Principal.selfAuthenticating(new Uint8Array(32).fill(7)).toText();
const subaccount = new Uint8Array(32);
subaccount[31] = 5;
const walletWithSubaccount = encodeIcrcAccount({
    owner: Principal.fromText(walletOwner),
    subaccount,
});

const transfer: PendingCryptocurrencyTransfer = {
    kind: "pending",
    ledger,
    token: "ICP",
    recipient,
    amountE8s: 100_000_000n,
    feeE8s: 10_000n,
    memo: 123n,
    createdAtNanos: 1_700_000_000_000_000_000n,
};

describe("icrc account address mapping", () => {
    test("round trips an account with no subaccount", () => {
        expect(formatIcrcAccount(addressToIcrcAccount(walletOwner))).toEqual(walletOwner);
    });

    test("round trips an account with a subaccount", () => {
        expect(formatIcrcAccount(addressToIcrcAccount(walletWithSubaccount))).toEqual(
            walletWithSubaccount,
        );
    });
});

describe("pending crypto transaction mapping", () => {
    test("emits ICRC1 when there is no fromAccount", () => {
        const api = apiPendingCryptoTransaction(transfer);
        expect(api).toHaveProperty("Pending.ICRC1");
        expect(api).not.toHaveProperty("Pending.ICRC2");
    });

    test("emits ICRC2 when a fromAccount is set", () => {
        const api = apiPendingCryptoTransaction({ ...transfer, fromAccount: walletWithSubaccount });
        expect(api).not.toHaveProperty("Pending.ICRC1");
        expect(api).toHaveProperty(
            "Pending.ICRC2.from",
            addressToIcrcAccount(walletWithSubaccount),
        );
    });

    test("an ICRC2 transfer round trips unchanged", () => {
        const domain = { ...transfer, fromAccount: walletWithSubaccount };
        const api = apiPendingCryptoTransaction(domain);
        if (!("Pending" in api)) throw new Error("Expected a pending transaction");
        expect(pendingCryptoTransfer(api.Pending, recipient)).toEqual(domain);
    });

    test("an ICRC1 transfer round trips unchanged", () => {
        const api = apiPendingCryptoTransaction(transfer);
        if (!("Pending" in api)) throw new Error("Expected a pending transaction");
        expect(pendingCryptoTransfer(api.Pending, recipient)).toEqual(transfer);
    });
});
