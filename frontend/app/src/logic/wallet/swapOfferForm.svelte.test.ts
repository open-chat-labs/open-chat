import { localUpdates, ONE_DAY, type MessageContext, type TokenInfo } from "@client";
import { afterEach, describe, expect, test } from "vitest";
import { SwapOfferForm, type TypedSwapOffer } from "./swapOfferForm.svelte";

const icp: TokenInfo = { ledger: "icp", symbol: "ICP", fee: 10_000n, decimals: 8 };
const chat: TokenInfo = { ledger: "chat", symbol: "CHAT", fee: 100_000n, decimals: 8 };
const context: MessageContext = { chatId: { kind: "group_chat", groupId: "g" } };

const offer: TypedSwapOffer = {
    give: icp,
    get: chat,
    balance: 1_000_000_000n,
    amountText: "1.29",
    wantText: "50",
    expiresInMs: ONE_DAY,
};

describe("a swap offer from a builder", () => {
    afterEach(() => localUpdates.draftMessages.delete(context));

    const attached = () => localUpdates.draftMessages.value.get(context)?.attachment;

    test("only a Diamond member makes one", () => {
        const form = new SwapOfferForm<string>();
        expect(form.review(offer, false, "draft")).toBe("upgrade");
        expect(form.stage.kind).toBe("editing");
    });

    // 5d invariant 3
    test("an attached swap amount is the typed amount in the token's smallest unit exactly", () => {
        const form = new SwapOfferForm<string>();
        expect(form.review(offer, true, "draft")).toBe("confirm");
        expect(form.confirm(context)).toBe(true);
        expect(attached()).toMatchObject({
            kind: "p2p_swap_content_initial",
            token0Amount: 129_000_000n,
            token1Amount: 5_000_000_000n,
            expiresIn: BigInt(ONE_DAY),
        });
    });

    test("is confirmed first with what it takes from the wallet, and nothing's attached until it is", () => {
        const form = new SwapOfferForm<string>();
        form.review(offer, true, "draft");
        expect(form.stage).toMatchObject({
            kind: "confirming",
            confirmation: { key: "p2pSwap.confirmSend", params: { amount: "1.2903", fees: 3 } },
        });
        expect(attached()).toBeUndefined();
        // back to the offer as it was filled in
        form.back();
        expect(form.stage).toEqual({ kind: "editing", draft: "draft" });
        expect(form.confirm(context)).toBe(false);
    });

    // 5d invariant 2, through the builder
    test("a swap offer's deposit fees are two transfer fees plus the approval fee, and its expiry is never past 90 days", () => {
        const form = new SwapOfferForm<string>();
        // 1 ICP held: an offer of it all leaves nothing for the three fees
        const all = { ...offer, balance: 100_000_000n, amountText: "1" };
        expect(form.review(all, true, "draft")).toBe("invalid");
        expect(form.review({ ...all, amountText: "0.9997" }, true, "draft")).toBe("confirm");
        form.review({ ...offer, expiresInMs: 400 * ONE_DAY }, true, "draft");
        expect(form.stage.kind === "confirming" && form.stage.content.expiresIn).toBe(
            BigInt(90 * ONE_DAY),
        );
    });

    test("offers at least 10 fees, for something of another token", () => {
        const form = new SwapOfferForm<string>();
        expect(form.review({ ...offer, amountText: "0.00099" }, true, "draft")).toBe("invalid");
        expect(form.review({ ...offer, get: icp }, true, "draft")).toBe("invalid");
        expect(form.review({ ...offer, wantText: "0" }, true, "draft")).toBe("invalid");
    });
});
