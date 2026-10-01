import { Principal } from "@icp-sdk/core/principal";
import type { DailyResultContent, MessageContent, PendingCryptocurrencyTransfer } from "@shared";
import { encodeIcrcAccount } from "@shared";
import { describe, expect, test } from "vitest";
import type { MessageContent as TMessageContent } from "../../typebox";
import {
    addressToIcrcAccount,
    apiMessageContent,
    apiPendingCryptoTransaction,
    formatIcrcAccount,
    messageContent,
    pendingCryptoTransfer,
    sendMessageSuccess,
    transferFrom,
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

describe("daily result custom content mapping", () => {
    const card: DailyResultContent = {
        kind: "daily_result",
        gameId: "crossword",
        number: 42,
        userId: "user-1",
        solveTimeMs: 123_456,
        hintsUsed: 2,
        streak: 7,
        layout: "0105050a0b",
        tier: 1,
    };

    function roundTrip(content: DailyResultContent) {
        return messageContent(apiMessageContent(content) as TMessageContent, "user-1");
    }

    test("round trips without a caption", () => {
        expect(roundTrip(card)).toEqual(card);
    });

    test("round trips a caption", () => {
        const captioned = { ...card, caption: "got there in the end" };
        expect(roundTrip(captioned)).toEqual(captioned);
    });

    test("writes the caption into the payload as version 1", () => {
        const api = apiMessageContent({ ...card, caption: "hi" });
        expect(api).toHaveProperty("Custom.kind", "daily_result");
        const json = JSON.parse(
            new TextDecoder().decode((api as { Custom: { data: Uint8Array } }).Custom.data),
        );
        expect(json.v).toBe(1);
        expect(json.caption).toBe("hi");
    });
});

describe("a transfer pulled by the canister its message is sent to", () => {
    const crypto: MessageContent = { kind: "crypto_content", caption: undefined, transfer };

    test("is pulled from the account given, as an ICRC2 transfer", () => {
        const content = transferFrom(crypto, walletOwner);

        expect(content).toEqual({ ...crypto, transfer: { ...transfer, fromAccount: walletOwner } });
        expect(
            apiPendingCryptoTransaction({ ...transfer, fromAccount: walletOwner }),
        ).toHaveProperty("Pending.ICRC2");
    });

    test("keeps the account it already names", () => {
        const fromWallet: MessageContent = {
            ...crypto,
            transfer: { ...transfer, fromAccount: walletWithSubaccount },
        };

        expect(transferFrom(fromWallet, walletOwner)).toBe(fromWallet);
    });

    test("a message holding no such transfer is left as it is", () => {
        const text: MessageContent = { kind: "text_content", text: "hello" };

        expect(transferFrom(text, walletOwner)).toBe(text);
    });

    test("comes back from a group or community as the transfer it made", () => {
        const sent = {
            event_index: 3,
            message_index: 2,
            timestamp: 10n,
            expires_at: undefined,
        };
        const completed = {
            ICRC2: {
                ledger: Principal.fromText(ledger).toUint8Array(),
                token_symbol: "ICP",
                amount: 100_000_000n,
                spender: Principal.fromText(recipient).toUint8Array(),
                from: { Account: addressToIcrcAccount(walletOwner) },
                to: { Account: addressToIcrcAccount(recipient) },
                fee: 10_000n,
                memo: undefined,
                created: 1n,
                block_index: 7n,
            },
        };

        expect(sendMessageSuccess({ ...sent, transfer: undefined })).toMatchObject({
            kind: "success",
            eventIndex: 3,
        });
        expect(
            sendMessageSuccess({ ...sent, transfer: completed }, "sender", recipient),
        ).toMatchObject({
            kind: "transfer_success",
            eventIndex: 3,
            transfer: { kind: "completed", sender: "sender", recipient, blockIndex: 7n },
        });
    });
});
