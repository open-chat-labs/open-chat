import { describe, expect, test } from "vitest";
import { walletSwapStepsUpTo } from "./tokenSwap";

describe("walletSwapStepsUpTo", () => {
    test("the steps so far end with the current one", () => {
        expect(walletSwapStepsUpTo("init")).toEqual(["init"]);
        expect(walletSwapStepsUpTo("swap")).toEqual(["init", "approve", "swap"]);
        expect(walletSwapStepsUpTo("withdraw")).toEqual(["init", "approve", "swap", "withdraw"]);
    });
});
