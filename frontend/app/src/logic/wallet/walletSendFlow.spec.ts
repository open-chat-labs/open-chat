import type { CryptoTransferOutcome, OpenChat, WithdrawOutcome } from "@client";
import { describe, expect, test, vi } from "vitest";
import { sendFromWallet, walletAddressCheck } from "./walletSendFlow";

const icp = { ledger: "icp-ledger", symbol: "ICP", decimals: 8, transferFee: 10_000n };

function client(transfer: CryptoTransferOutcome, withdrawal: WithdrawOutcome) {
    return {
        sendCryptoTransfer: vi.fn<OpenChat["sendCryptoTransfer"]>(async () => transfer),
        withdraw: vi.fn<OpenChat["withdraw"]>(async () => withdrawal),
    };
}

describe("a send from the wallet", () => {
    test("to a person: a transfer in their DM, with the note", async () => {
        const c = client(
            { kind: "sent" } as CryptoTransferOutcome,
            { kind: "sent" } as WithdrawOutcome,
        );
        const out = await sendFromWallet(
            c,
            icp,
            100_000_000n,
            {
                amountText: "0.5",
                max: false,
                userId: "u1",
                to: "u1",
                network: "ledger",
                memo: "lunch",
            },
            undefined,
        );
        expect(out).toEqual({ kind: "sent" });
        expect(c.sendCryptoTransfer).toHaveBeenCalledOnce();
        expect(c.sendCryptoTransfer.mock.calls[0][0]).toEqual({
            chatId: { kind: "direct_chat", userId: "u1" },
        });
        expect(c.sendCryptoTransfer.mock.calls[0][2]).toBe("lunch");
        expect(c.withdraw).not.toHaveBeenCalled();
    });

    test("to an address: a withdrawal over the ledger paying its fee", async () => {
        const c = client(
            { kind: "sent" } as CryptoTransferOutcome,
            { kind: "cancelled" } as WithdrawOutcome,
        );
        const out = await sendFromWallet(
            c,
            icp,
            100_000_000n,
            { amountText: "0.5", max: false, to: "2vxsx-fae", network: "ledger" },
            undefined,
        );
        expect(out).toEqual({ kind: "not_sent" });
        expect(c.withdraw).toHaveBeenCalledWith({
            ledger: "icp-ledger",
            symbol: "ICP",
            route: { kind: "ledger" },
            to: "2vxsx-fae",
            amount: 50_000_000n,
            fee: 10_000n,
        });
    });

    test("too little to a person, or nothing at all, sends nothing", async () => {
        const c = client(
            { kind: "sent" } as CryptoTransferOutcome,
            { kind: "sent" } as WithdrawOutcome,
        );
        const base = { max: false, userId: "u1", to: "u1", network: "ledger" };
        expect(
            await sendFromWallet(c, icp, 1n, { ...base, amountText: "0.00001" }, undefined),
        ).toEqual({
            kind: "too_small",
            minimum: 100_000n,
        });
        expect(await sendFromWallet(c, icp, 1n, { ...base, amountText: "" }, undefined)).toEqual({
            kind: "nothing",
        });
        expect(c.sendCryptoTransfer).not.toHaveBeenCalled();
    });

    test("a refused PIN says so", async () => {
        const c = client(
            { kind: "pin_failed" } as CryptoTransferOutcome,
            { kind: "sent" } as WithdrawOutcome,
        );
        const out = await sendFromWallet(
            c,
            icp,
            100_000_000n,
            { amountText: "0.5", max: false, userId: "u1", to: "u1", network: "ledger" },
            undefined,
        );
        expect(out).toEqual({ kind: "failed", reason: "pin" });
    });
});

describe("the addresses Send takes", () => {
    test("never an account of a MultiUser user id, and only on the token's networks", () => {
        const check = walletAddressCheck(
            {
                cryptoAccount: "a".repeat(64),
                userId: "rrkah-fqaaa-aaaaa-aaaaq-cai",
                principal: () => "2vxsx-fae",
            },
            (address) => address === "ryjl3-tyaaa-aaaaa-aaaba-cai",
        );
        expect(check("ryjl3-tyaaa-aaaaa-aaaba-cai", "ICP")).toBe(false);
        expect(check("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "ICP")).toBe(false);
        expect(check("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "BTC")).toBe(true);
        expect(check("qoctq-giaaa-aaaaa-aaaea-cai", "CHAT")).toBe(true);
    });
});
