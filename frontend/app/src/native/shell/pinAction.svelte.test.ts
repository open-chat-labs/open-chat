import { describe, expect, test } from "vitest";
import { chipParts, pinAction, type PinChip } from "./pinAction.svelte";

const chip = (text: string, amount: string): PinChip => ({
    text,
    amount,
    token: { symbol: "ICP", mark: "I", grad: "red" },
});

describe("the PIN sheet's chip", () => {
    test("says what the transfer running confirms, and nothing once it's over", async () => {
        const sending = chip("Send 25 ICP to Julian", "25 ICP");
        let during: PinChip | undefined;
        const out = await pinAction.during(sending, async () => {
            during = pinAction.chip;
            return 7;
        });
        expect(out).toBe(7);
        expect(during).toBe(sending);
        expect(pinAction.chip).toBeUndefined();
    });

    test("a transfer that fails clears it too", async () => {
        await expect(
            pinAction.during(chip("Swap 1 ICP for CHAT", "1 ICP"), () =>
                Promise.reject(new Error("no")),
            ),
        ).rejects.toThrow("no");
        expect(pinAction.chip).toBeUndefined();
    });

    test("the amount is cut out of its words, wherever the language puts it", () => {
        expect(chipParts(chip("Send 25 ICP to Julian", "25 ICP"))).toEqual([
            "Send ",
            "25 ICP",
            " to Julian",
        ]);
        expect(chipParts(chip("25 ICP an Julian senden", "25 ICP"))).toEqual([
            "",
            "25 ICP",
            " an Julian senden",
        ]);
        expect(chipParts(chip("Send to Julian", "25 ICP"))).toEqual(["Send to Julian", "", ""]);
    });
});
