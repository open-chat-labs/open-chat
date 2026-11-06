import {
    allUsersStore,
    anonymousUser,
    cryptoBalanceStore,
    cryptoLookup,
    currentUserStore,
    ICP_SYMBOL,
    LEDGER_CANISTER_CHAT,
    LEDGER_CANISTER_ICP,
    localUpdates,
    type ChatSummary,
    type CryptocurrencyDetails,
    type MessageContext,
    type OpenChat,
    type UserSummary,
} from "@client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CryptoTransferForm } from "./cryptoTransferForm.svelte";

const icp: CryptocurrencyDetails = {
    name: "Internet Computer",
    symbol: ICP_SYMBOL,
    ledger: LEDGER_CANISTER_ICP,
    index: undefined,
    decimals: 8,
    transferFee: 10_000n,
    logo: "",
    infoUrl: "",
    transactionUrlFormat: "",
    supportedStandards: [],
    added: 0n,
    enabled: true,
    oneSecEnabled: false,
    evmContractAddresses: [],
    lastUpdated: 0n,
};

const user = (userId: string, kind: "user" | "bot" = "user"): UserSummary =>
    ({ kind, userId, username: userId }) as UserSummary;

const group = {
    kind: "group_chat",
    id: { kind: "group_chat", groupId: "g" },
} as ChatSummary;
const dm = {
    kind: "direct_chat",
    id: { kind: "direct_chat", userId: "bob" },
    them: { userId: "bob" },
} as ChatSummary;
const context: MessageContext = { chatId: group.id };

// the form builders get their own: the token's balance is the one already known
const form = (chat: ChatSummary, defaultReceiver?: string) =>
    new CryptoTransferForm({} as OpenChat, LEDGER_CANISTER_ICP, chat, defaultReceiver, 0n, {
        refreshBalance: false,
    });

describe("a transfer from a builder", () => {
    beforeEach(() => {
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        allUsersStore.set(
            new Map([
                ["me", user("me")],
                ["bob", user("bob")],
                ["bot", user("bot", "bot")],
            ]),
        );
        cryptoLookup.set(new Map([[icp.ledger, icp]]));
        cryptoBalanceStore.setBalance(icp.ledger, 100_000_000n);
    });

    afterEach(() => {
        localUpdates.draftMessages.delete(context);
        currentUserStore.set(anonymousUser());
        allUsersStore.set(new Map());
        cryptoLookup.set(new Map());
    });

    const attached = () => localUpdates.draftMessages.value.get(context)?.attachment;

    // 5d invariant 5
    test("a transfer never defaults to the sender as its recipient", () => {
        expect(form(group, "me").receiver).toBeUndefined();
        expect(form(group, "bob").receiver?.userId).toBe("bob");
        expect(form(dm).receiver?.userId).toBe("bob");
        // nor is it attached to them when picked
        expect(form(group).attachTyped(context, icp.ledger, "0.5", "me")).toBe("invalid");
        expect(attached()).toBeUndefined();
    });

    // 5d invariant 3
    test("an attached transfer amount is the typed amount in the token's smallest unit exactly", () => {
        expect(form(group).attachTyped(context, icp.ledger, "0.29", "bob")).toBe("attached");
        const content = attached();
        expect(content?.kind === "crypto_content" && content.transfer).toMatchObject({
            kind: "pending",
            ledger: icp.ledger,
            recipient: "bob",
            // 0.29 * 1e8 as a float is 28999999.999999996
            amountE8s: 29_000_000n,
            feeE8s: 10_000n,
        });
        // a comma decimal mark reads the same
        expect(form(group).attachTyped(context, icp.ledger, "0,29", "bob")).toBe("attached");
        const again = attached();
        expect(again?.kind === "crypto_content" && again.transfer.amountE8s).toBe(29_000_000n);
    });

    test("is at least the minimum, and within the balance less the transfer's and approval's fees", () => {
        // 10 fees
        expect(form(group).attachTyped(context, icp.ledger, "0.00099", "bob")).toBe("invalid");
        expect(form(group).attachTyped(context, icp.ledger, "0.001", "bob")).toBe("attached");
        // 1 ICP held: two fees (the transfer's and its approval's) stay for the ledger
        expect(form(group).attachTyped(context, icp.ledger, "0.9998", "bob")).toBe("attached");
        expect(form(group).attachTyped(context, icp.ledger, "0.99981", "bob")).toBe("invalid");
    });

    test("never goes to a bot, which has no wallet", () => {
        expect(form(group).attachTyped(context, icp.ledger, "0.5", "bot")).toBe("invalid");
    });

    // a token the registry doesn't carry would fall back to ICP
    test("isn't attached in a token the registry doesn't carry", () => {
        localUpdates.draftMessages.delete(context);
        expect(form(group).attachTyped(context, LEDGER_CANISTER_CHAT, "1", "bob")).toBe("invalid");
        expect(attached()).toBeUndefined();
    });
});
