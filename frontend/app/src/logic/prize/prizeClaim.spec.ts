import type { ClaimPrizeOutcome, OpenChat } from "@client";
import { i18nKey } from "@src/i18n/i18n";
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
    test("claims with the token of the prize's human check", async () => {
        const c = client({ kind: "success" });
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });

        const e = trustedClick();
        await expect(claimPrizeWithHumanCheck(c, check, chatId, 1n, e)).resolves.toBeUndefined();
        expect(c.claimPrize).toHaveBeenCalledWith(chatId, 1n, e, { token: "t1", salt: "s1" });
    });

    test("a check that fails still claims, without a token, for the backend to decide", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const c = client({ kind: "success" });
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_error", code: "600010" });

        const claim = claimPrizeWithHumanCheck(c, check, chatId, 1n, trustedClick());
        check.receive({ kind: "turnstile_error", code: "600010" });
        await claim;
        expect(c.claimPrize).toHaveBeenCalledWith(chatId, 1n, expect.anything(), undefined);
    });

    test("says why a claim failed", async () => {
        const message = i18nKey("prizes.humanCheckFailed");
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });

        await expect(
            claimPrizeWithHumanCheck(
                client({ kind: "failed", message }),
                check,
                chatId,
                1n,
                trustedClick(),
            ),
        ).resolves.toEqual(message);
    });

    // 5a invariant 2: a prize claim is sent only from a trusted click
    test("a script's click claims nothing, and leaves the token for the reader's", async () => {
        const c = client({ kind: "success" });
        const check = new HumanCheck();
        check.receive({ kind: "turnstile_token", token: "t1", salt: "s1" });

        await expect(
            claimPrizeWithHumanCheck(c, check, chatId, 1n, new MouseEvent("click")),
        ).resolves.toBeUndefined();
        expect(c.claimPrize).not.toHaveBeenCalled();
        await expect(check.take()).resolves.toEqual({ token: "t1", salt: "s1" });
    });
});
