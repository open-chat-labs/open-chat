import { localUpdates, ONE_DAY, type MessageContext } from "@client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
    DEFAULT_PRIZE_CONFIG,
    parsePrizeConfig,
    PrizeForm,
    type PrizeToken,
} from "./prizeForm.svelte";

const icp: PrizeToken = { ledger: "icp", symbol: "ICP", decimals: 8, transferFee: 10_000n };
const context: MessageContext = { chatId: { kind: "group_chat", groupId: "g" } };

describe("the prize settings remembered", () => {
    test("are read however a tree stored them", () => {
        // the old desktop builder's
        expect(
            parsePrizeConfig(
                JSON.stringify({
                    minChitEarned: 5000,
                    diamond: "lifetime",
                    uniquePersonOnly: true,
                    minStreak: 7,
                    distribution: "equal",
                    duration: "oneWeek",
                }),
            ),
        ).toEqual({
            distribution: "equal",
            durationMs: 7 * ONE_DAY,
            diamond: "lifetime",
            minStreak: 7,
            minChitEarned: 5000,
        });
        // the mobile builder's bigint, as JSON.stringify wrote it
        expect(parsePrizeConfig('{"duration":"3600000"}').durationMs).toBe(3_600_000);
        // this module's own
        expect(parsePrizeConfig('{"durationMs":21600000}').durationMs).toBe(21_600_000);
    });

    test("fall back to the defaults where they can't be read", () => {
        expect(parsePrizeConfig("not json")).toEqual(DEFAULT_PRIZE_CONFIG);
        expect(parsePrizeConfig("null")).toEqual(DEFAULT_PRIZE_CONFIG);
        expect(parsePrizeConfig('{"duration":"forever","diamond":"gold","minStreak":-1}')).toEqual(
            DEFAULT_PRIZE_CONFIG,
        );
    });
});

describe("a prize from a builder", () => {
    beforeEach(() => localStorage.removeItem("openchat_prize_config"));
    afterEach(() => {
        localUpdates.draftMessages.delete(context);
        localStorage.removeItem("openchat_prize_config");
    });

    const attached = () => localUpdates.draftMessages.value.get(context)?.attachment;

    // 5d invariant 3
    test("an attached prize amount is the typed amount in the token's smallest unit exactly", () => {
        const form = new PrizeForm();
        expect(form.attachTyped(context, icp, 10_000_000_000n, "2.29")).toBe("attached");
        const content = attached();
        expect(content?.kind === "prize_content_initial" && content.amount).toBe(229_000_000n);
    });

    test("is at least 100 transfer fees a winner, and within the balance with its fees", () => {
        const form = new PrizeForm();
        form.winners = 10;
        // 10 winners: at least 0.1 ICP
        expect(form.attachTyped(context, icp, 10_000_000_000n, "0.09")).toBe("invalid");
        expect(form.attachTyped(context, icp, 10_000_000_000n, "0.1")).toBe("attached");
        // 1 ICP held can't fund a 1 ICP prize with its fees
        expect(form.attachTyped(context, icp, 100_000_000n, "1")).toBe("invalid");
        form.winners = 0;
        expect(form.attachTyped(context, icp, 10_000_000_000n, "1")).toBe("invalid");
    });

    test("never in a DM", () => {
        const dm: MessageContext = { chatId: { kind: "direct_chat", userId: "bob" } };
        expect(new PrizeForm().attachTyped(dm, icp, 10_000_000_000n, "1")).toBe("invalid");
        expect(localUpdates.draftMessages.value.get(dm)?.attachment).toBeUndefined();
    });

    test("remembers its split, duration and restrictions for the next prize", () => {
        const form = new PrizeForm();
        form.distribution = "equal";
        form.durationMs = 6 * 60 * 60 * 1000;
        form.toggleDiamond("lifetime");
        form.minStreak = 30;
        expect(form.attachTyped(context, icp, 10_000_000_000n, "1")).toBe("attached");
        const next = new PrizeForm();
        expect([next.distribution, next.durationMs, next.diamond, next.minStreak]).toEqual([
            "equal",
            6 * 60 * 60 * 1000,
            "lifetime",
            30,
        ]);
        next.toggleDiamond("lifetime");
        expect(next.diamond).toBe("none");
    });
});
