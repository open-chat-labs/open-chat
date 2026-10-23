// Paying CHIT for a premium item (custom emojis, a profile background), in every tree: its price
// against the user's balance, and the payment, whose outcome the view shows.

import { PremiumItem, premiumPrices, type OpenChat, type ResourceKey } from "@client";
import { i18nKey } from "@src/i18n/i18n";

export const premiumItemLabels: Record<PremiumItem, ResourceKey> = {
    [PremiumItem.BotEmojis]: i18nKey("premiumItem.botEmojis"),
    [PremiumItem.PopularEmojis]: i18nKey("premiumItem.popularEmojis"),
    [PremiumItem.CustomProfileBackground]: i18nKey("premiumItem.customProfileBackground"),
};

export type PremiumItemPaymentOutcome = { kind: "paid" } | { kind: "failed"; reason: ResourceKey };

export class PremiumItemPayment {
    #client: Pick<OpenChat, "payForPremiumItem">;
    #balance: () => number;
    readonly item: PremiumItem;
    readonly price: number;
    paying = $state(false);

    /** `balance` is the user's CHIT balance. */
    constructor(
        client: Pick<OpenChat, "payForPremiumItem">,
        item: PremiumItem,
        balance: () => number,
    ) {
        this.#client = client;
        this.#balance = balance;
        this.item = item;
        this.price = premiumPrices[item];
    }

    get label(): ResourceKey {
        return premiumItemLabels[this.item];
    }

    get balance(): number {
        return this.#balance();
    }

    get insufficient(): boolean {
        return this.balance < this.price;
    }

    get canPay(): boolean {
        return !this.paying && !this.insufficient;
    }

    async pay(): Promise<PremiumItemPaymentOutcome> {
        if (!this.canPay) return { kind: "failed", reason: i18nKey("premiumItem.paymentFailure") };
        this.paying = true;
        try {
            const resp = await this.#client.payForPremiumItem(this.item);
            return resp.kind === "success"
                ? { kind: "paid" }
                : { kind: "failed", reason: i18nKey("premiumItem.paymentFailure") };
        } finally {
            this.paying = false;
        }
    }
}
