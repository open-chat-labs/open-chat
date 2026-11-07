import type { ClaimPrizeOutcome, OpenChat } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { claimsStore } from "@src/stores/claims";
import { describe, expect, test, vi } from "vitest";
import { HumanCheck } from "./humanCheck.svelte";
import { claimPrizeWithHumanCheck } from "./prizeClaim";

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
    test("runs the prize's human check, and claims with its token", async () => {
        const c = client({ kind: "success" });
        const check = new HumanCheck();
        const e = trustedClick();

        const claim = claimPrizeWithHumanCheck(c, check, chatId, 1n, e);
        expect(check.running).toBe(true);
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });

        await expect(claim).resolves.toBeUndefined();
        expect(c.claimPrize).toHaveBeenCalledWith(chatId, 1n, e, { token: "t1", salt: "s1" });
    });

    test("a check that fails still claims, without a token, for the backend to decide", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const c = client({ kind: "success" });
        const check = new HumanCheck();

        const claim = claimPrizeWithHumanCheck(c, check, chatId, 1n, trustedClick());
        check.receive({ kind: "turnstile_error", code: "600010" });
        await claim;
        expect(c.claimPrize).toHaveBeenCalledWith(chatId, 1n, expect.anything(), undefined);
    });

    test("says why a claim failed", async () => {
        const message = i18nKey("prizes.humanCheckFailed");
        const check = new HumanCheck();

        const claim = claimPrizeWithHumanCheck(
            client({ kind: "failed", message }),
            check,
            chatId,
            1n,
            trustedClick(),
        );
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        await expect(claim).resolves.toEqual(message);
    });

    test("a click while the prize's claim is in flight claims nothing", async () => {
        const c = client({ kind: "success" });
        const check = new HumanCheck();

        const claim = claimPrizeWithHumanCheck(c, check, chatId, 1n, trustedClick());
        await expect(
            claimPrizeWithHumanCheck(c, check, chatId, 1n, trustedClick()),
        ).resolves.toBeUndefined();
        expect(check.run).toBe(1);

        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
        await claim;
        expect(c.claimPrize).toHaveBeenCalledTimes(1);

        // Once it's settled, the reader can claim again
        const retry = claimPrizeWithHumanCheck(c, check, chatId, 1n, trustedClick());
        expect(check.run).toBe(2);
        check.receive({ kind: "turnstile_token", token: "t2", salt: "s2" });
        await retry;
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
            const check = new HumanCheck();

            const claim = claimPrizeWithHumanCheck(c, check, chatId, 1n, trustedClick());
            // through the human check
            expect(claimsStore.value.has(1n)).toBe(true);
            check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });
            await vi.waitFor(() => expect(c.claimPrize).toHaveBeenCalled());
            // and the claim itself
            expect(claimsStore.value.has(1n)).toBe(true);

            resolve(outcome);
            await claim;
            expect(claimsStore.value.has(1n)).toBe(false);
        }
    });

    // 5a invariant 2: a prize claim is sent only from a trusted click
    test("a script's click claims nothing, and doesn't start the check", async () => {
        const c = client({ kind: "success" });
        const check = new HumanCheck();

        await expect(
            claimPrizeWithHumanCheck(c, check, chatId, 1n, new MouseEvent("click")),
        ).resolves.toBeUndefined();
        expect(c.claimPrize).not.toHaveBeenCalled();
        expect(check.running).toBe(false);
        expect(check.run).toBe(0);
    });
});
