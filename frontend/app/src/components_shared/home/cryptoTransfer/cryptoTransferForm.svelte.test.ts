import {
    allUsersStore,
    cryptoBalanceStore,
    cryptoLookup,
    currentUserStore,
    LEDGER_CANISTER_ICP,
    localUpdates,
    anonymousUser,
    type ChatSummary,
    type CryptocurrencyDetails,
    type MessageContext,
    type OpenChat,
    type SignerWallet,
    type UserSummary,
} from "@client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CryptoTransferForm } from "@src/logic/cryptoTransfer/cryptoTransferForm.svelte";

const icp = {
    name: "Internet Computer",
    symbol: "ICP",
    ledger: LEDGER_CANISTER_ICP,
    decimals: 8,
    transferFee: 10_000n,
    enabled: true,
} as unknown as CryptocurrencyDetails;

const client = {
    refreshAccountBalance: vi.fn(async () => 0n),
    sendCryptoTransfer: vi.fn(async () => ({ kind: "sent" })),
} as unknown as OpenChat;

const them = { userId: "them", username: "them" } as UserSummary;
const me = { userId: "me", username: "me" } as UserSummary;
const bot = { kind: "bot", userId: "bot", username: "bot" } as UserSummary;

const group = {
    kind: "group_chat",
    id: { kind: "group_chat", groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
} as unknown as ChatSummary;
const direct = {
    kind: "direct_chat",
    id: { kind: "direct_chat", userId: "them" },
    them: { kind: "direct_chat", userId: "them" },
} as unknown as ChatSummary;
const context: MessageContext = { chatId: group.id };

const wallet = { id: "plug" } as unknown as SignerWallet;

describe("sending tokens to a user", () => {
    beforeEach(() => {
        cryptoLookup.set(new Map([[icp.ledger, icp]]));
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        allUsersStore.set(
            new Map([
                ["them", them],
                ["me", me],
                ["bot", bot],
            ]),
        );
        cryptoBalanceStore.setBalance(icp.ledger, 100_000_000n);
    });

    afterEach(() => {
        cryptoLookup.set(new Map());
        currentUserStore.set(anonymousUser());
        allUsersStore.set(new Map());
        cryptoBalanceStore.setBalance(icp.ledger, 0n);
        localUpdates.draftMessages.delete(context);
        vi.clearAllMocks();
    });

    // Invariant: the tokens go to the other user in a direct chat, or the user being replied to,
    // and never back to the user themselves
    test("the recipient is the other user in a direct chat, and never the user themselves", () => {
        const recipient = (chat: ChatSummary, replyingTo: string | undefined) =>
            new CryptoTransferForm(client, icp.ledger, chat, replyingTo, 0n).receiver?.userId;

        expect(recipient(direct, undefined)).toBe("them");
        expect(recipient(group, "them")).toBe("them");
        expect(recipient(group, "me")).toBe(undefined);
    });

    // Invariant: tokens are never sent to a bot. Its id isn't an account anyone controls, so they
    // would be lost.
    test("a bot is never the recipient", async () => {
        const botChat = {
            ...direct,
            id: { kind: "direct_chat", userId: "bot" },
            them: { kind: "direct_chat", userId: "bot" },
        } as unknown as ChatSummary;
        expect(new CryptoTransferForm(client, icp.ledger, botChat, undefined, 0n).receiver).toBe(
            undefined,
        );
        expect(new CryptoTransferForm(client, icp.ledger, group, "bot", 0n).receiver).toBe(
            undefined,
        );

        // nor can one be chosen
        const form = new CryptoTransferForm(client, icp.ledger, group, "them", 5_000_000n);
        await vi.waitFor(() => expect(form.tokenChanging).toBe(false));
        expect(form.valid).toBe(true);
        form.receiver = bot;
        expect(form.valid).toBe(false);
    });

    // Invariant: an amount from a /crypto command is the one offered. Mobile dropped it.
    test("the amount the transfer was started with is kept", () => {
        const form = new CryptoTransferForm(client, icp.ledger, group, "them", 5_000_000n);

        expect(form.tokenState.draftAmount).toBe(5_000_000n);
    });

    // Invariant: the user can't send less than the minimum, or more than their OpenChat account
    // can pay with the fees; an external wallet's balance is its own business
    test("the amount is at least the minimum and within what the account can pay", async () => {
        // 1 ICP less the transfer and approval fees
        const limit = 100_000_000n - 20_000n;
        const form = new CryptoTransferForm(client, icp.ledger, group, "them", limit);
        // not until the balance has been checked
        expect(form.valid).toBe(false);
        await vi.waitFor(() => expect(form.tokenChanging).toBe(false));
        expect(form.valid).toBe(true);

        form.tokenState.draftAmount = limit + 1n;
        expect(form.valid).toBe(false);

        form.sourceWallet = wallet;
        expect(form.valid).toBe(true);

        // ten fees is the minimum
        form.tokenState.draftAmount = 99_999n;
        expect(form.valid).toBe(false);
    });

    // Invariant: a draft paying from an external wallet names the wallet and carries no approved
    // account, so the send asks the wallet. A draft with neither would take the funds from the
    // user's OpenChat account.
    test("a draft paying from an external wallet asks that wallet when it is sent", () => {
        const form = new CryptoTransferForm(client, icp.ledger, group, "them", 5_000_000n);
        form.sourceWallet = wallet;

        form.attach(context);

        const draft = localUpdates.draftMessages.value.get(context)?.attachment;
        expect(draft?.kind).toBe("crypto_content");
        const transfer = draft?.kind === "crypto_content" ? draft.transfer : undefined;
        expect(transfer).toMatchObject({
            ledger: icp.ledger,
            recipient: "them",
            amountE8s: 5_000_000n,
            feeE8s: 10_000n,
            fromWallet: "plug",
        });
        expect(transfer?.kind === "pending" && transfer.fromAccount).toBe(undefined);
    });

    // Invariant: the transfer goes to the chosen recipient, from the wallet that approved it if
    // there is one, with the ledger's transfer fee
    test("a transfer is sent to the chosen recipient from the approving wallet", async () => {
        const form = new CryptoTransferForm(client, icp.ledger, group, undefined, 5_000_000n);
        form.receiver = them;

        await form.send(context, "thanks", "wallet-account");

        expect(client.sendCryptoTransfer).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                ledger: icp.ledger,
                recipient: "them",
                amountE8s: 5_000_000n,
                feeE8s: 10_000n,
                fromAccount: "wallet-account",
            }),
            "thanks",
        );
    });
});
