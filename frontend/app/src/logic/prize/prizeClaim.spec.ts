import type { ClaimPrizeOutcome, OpenChat } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { claimsStore } from "@src/stores/claims";
import { describe, expect, test, vi } from "vitest";
import { claimPrizeFromClick } from "./prizeClaim";

const chatId = { kind: "group_chat" as const, groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" };

// A click the user made: an event made in a test is never trusted, and its isTrusted can't be
// redefined, so this is a stand-in with MouseEvent's prototype
function trustedClick(): MouseEvent {
    return Object.create(MouseEvent.prototype, {
        isTrusted: { value: true },
        type: { value: "click" },
    }) as MouseEvent;
}

function client(outcome: ClaimPrizeOutcome) {
    return { claimPrize: vi.fn(async () => outcome) } as never as Pick<OpenChat, "claimPrize"> & {
        claimPrize: ReturnType<typeof vi.fn>;
    };
}

describe("claiming a prize", () => {
    test("claims the prize from the click", async () => {
        const c = client({ kind: "success" });
        const e = trustedClick();

        await expect(claimPrizeFromClick(c, chatId, 1n, e)).resolves.toBeUndefined();
        expect(c.claimPrize).toHaveBeenCalledWith(chatId, 1n, e);
    });

    test("says why a claim failed", async () => {
        const message = i18nKey("prizes.claimFailed");

        await expect(
            claimPrizeFromClick(client({ kind: "failed", message }), chatId, 1n, trustedClick()),
        ).resolves.toEqual(message);
    });

    test("a click while the prize's claim is in flight claims nothing", async () => {
        const c = client({ kind: "success" });

        const claim = claimPrizeFromClick(c, chatId, 1n, trustedClick());
        await expect(claimPrizeFromClick(c, chatId, 1n, trustedClick())).resolves.toBeUndefined();
        await claim;
        expect(c.claimPrize).toHaveBeenCalledTimes(1);

        // Once it's settled, the reader can claim again
        await claimPrizeFromClick(c, chatId, 1n, trustedClick());
        expect(c.claimPrize).toHaveBeenCalledTimes(2);
    });

    test("the prize is being claimed from the click until the claim settles, either way", async () => {
        for (const outcome of [
            { kind: "success" },
            { kind: "failed", message: i18nKey("prizes.claimFailed") },
        ] as ClaimPrizeOutcome[]) {
            let resolve: (o: ClaimPrizeOutcome) => void = () => undefined;
            const c = {
                claimPrize: vi.fn(() => new Promise<ClaimPrizeOutcome>((r) => (resolve = r))),
            } as never as Pick<OpenChat, "claimPrize">;

            const claim = claimPrizeFromClick(c, chatId, 1n, trustedClick());
            expect(claimsStore.value.has(1n)).toBe(true);

            resolve(outcome);
            await claim;
            expect(claimsStore.value.has(1n)).toBe(false);
        }
    });

    // 5a invariant 2: a prize claim is sent only from a trusted click
    test("a script's click claims nothing", async () => {
        const c = client({ kind: "success" });

        await expect(
            claimPrizeFromClick(c, chatId, 1n, new MouseEvent("click")),
        ).resolves.toBeUndefined();
        expect(c.claimPrize).not.toHaveBeenCalled();
    });
});
