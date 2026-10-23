import { PremiumItem, premiumPrices, type PayForPremiumItemResponse } from "@client";
import { PremiumItemPayment } from "./premiumItemPayment.svelte";

const item = PremiumItem.CustomProfileBackground;
const price = premiumPrices[item];

function client(resp: PayForPremiumItemResponse) {
    return { payForPremiumItem: vi.fn(async () => resp) };
}

const paid: PayForPremiumItemResponse = { kind: "success", totalChitEarned: 0, chitBalance: 0 };

describe("paying for a premium item", () => {
    test("costs the item's price", () => {
        const payment = new PremiumItemPayment(client(paid), item, () => price);
        expect(payment.price).toBe(price);
        expect(payment.label.key).toBe("premiumItem.customProfileBackground");
    });

    test("can't be paid with less CHIT than the price, and isn't sent", async () => {
        const c = client(paid);
        const payment = new PremiumItemPayment(c, item, () => price - 1);
        expect(payment.insufficient).toBe(true);
        expect((await payment.pay()).kind).toBe("failed");
        expect(c.payForPremiumItem).not.toHaveBeenCalled();
    });

    test("is paid", async () => {
        const c = client(paid);
        const payment = new PremiumItemPayment(c, item, () => price);
        expect(await payment.pay()).toEqual({ kind: "paid" });
        expect(c.payForPremiumItem).toHaveBeenCalledWith(item);
        expect(payment.paying).toBe(false);
    });

    test("says so when the payment fails", async () => {
        const failed = { kind: "error", code: 0, message: undefined } as PayForPremiumItemResponse;
        const payment = new PremiumItemPayment(client(failed), item, () => price);
        expect(await payment.pay()).toEqual({
            kind: "failed",
            reason: expect.objectContaining({ key: "premiumItem.paymentFailure" }),
        });
    });
});
