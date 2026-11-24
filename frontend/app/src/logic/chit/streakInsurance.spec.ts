import {
    insuranceQuote,
    LADDER_RUNGS,
    streakInsuranceBalance,
    streakInsuranceDialogPrices,
    streakInsurancePurchase,
} from "./streakInsurance";

describe("streak insurance", () => {
    const CHAT = 100_000_000n;

    test("a streak insurance purchase sends streakInsurancePrice(daysInsured, days) computed from streakInsuranceStore, never the dialog's cost, and cover bought never passes 30 days", () => {
        // 3 bought, 1 used: the next two are the 4th and 5th bought
        expect(streakInsurancePurchase({ daysInsured: 3, daysMissed: 1 }, 2)).toEqual({
            days: 2,
            price: (8n + 16n) * CHAT,
        });
        // 28 bought: only 2 more
        expect(streakInsurancePurchase({ daysInsured: 28, daysMissed: 0 }, 5).days).toBe(2);
        expect(streakInsurancePurchase({ daysInsured: 30, daysMissed: 4 }, 1)).toEqual({
            days: 0,
            price: 0n,
        });
    });

    test("the balance the insurance dialog checks against is the CHAT balance less the approval fee, so a day it offers can be paid", () => {
        // a 0.001 CHAT transfer fee, which the approval costs
        const fee = 100_000n;
        expect(streakInsuranceBalance(5n * CHAT, fee)).toBe(4.999);
        // 2 CHAT less the fee can't pay a 2 CHAT day
        expect(streakInsuranceBalance(2n * CHAT, fee)).toBeLessThan(2);
        expect(streakInsuranceBalance(0n, fee)).toBe(0);
        // CHAT's fee not known yet: nothing known to be spendable
        expect(streakInsuranceBalance(5n * CHAT, undefined)).toBe(0);
    });

    test("the dialog's prices are what the backend charges, after missed days too", () => {
        // nothing used: 1, 2, 4 … CHAT, 30 positions
        const fresh = streakInsuranceDialogPrices({ daysInsured: 0, daysMissed: 0 });
        expect(fresh.slice(0, 3)).toEqual([1, 2, 4]);
        expect(fresh).toHaveLength(30);
        // 3 bought, 1 used: 2 held, so the dialog's next position (2) must cost the 4th bought day
        const prices = streakInsuranceDialogPrices({ daysInsured: 3, daysMissed: 1 });
        const held = 3 - 1;
        expect(BigInt(prices[held] + prices[held + 1]) * CHAT).toBe(
            streakInsurancePurchase({ daysInsured: 3, daysMissed: 1 }, 2).price,
        );
        // and no more positions than days left to buy: 2 held + 27 more = 29 = 30 - 1 used
        expect(prices).toHaveLength(29);
    });
});

describe("the native screen's quote", () => {
    const prices = streakInsuranceDialogPrices({ daysInsured: 3, daysMissed: 1 });

    test("holds the cover bought less used, and adds the days picked within the room", () => {
        const quote = insuranceQuote(prices, { daysInsured: 3, daysMissed: 1 }, 2, 1_000_000);
        expect(quote).toMatchObject({ held: 2, used: 1, room: 27, days: 2, canBuy: true });
        // what it costs is what the purchase sends
        expect(BigInt(quote.total) * 100_000_000n).toBe(
            streakInsurancePurchase({ daysInsured: 3, daysMissed: 1 }, 2).price,
        );
    });

    test("shows the next rungs of the ladder from the next day to add, those added marked", () => {
        const quote = insuranceQuote(prices, { daysInsured: 3, daysMissed: 1 }, 2, 1_000_000);
        expect(quote.ladder).toHaveLength(LADDER_RUNGS);
        expect(quote.ladder[0]).toMatchObject({ position: 2, price: prices[2], adding: true });
        expect(quote.ladder.filter((r) => r.adding)).toHaveLength(2);
    });

    test("can't buy what the balance can't pay, nor once the cover is full", () => {
        expect(insuranceQuote(prices, { daysInsured: 3, daysMissed: 1 }, 2, 1).canBuy).toBe(false);
        const full = insuranceQuote(
            streakInsuranceDialogPrices({ daysInsured: 30, daysMissed: 0 }),
            { daysInsured: 30, daysMissed: 0 },
            1,
            1_000_000,
        );
        expect(full).toMatchObject({ room: 0, days: 0, canBuy: false });
    });
});
