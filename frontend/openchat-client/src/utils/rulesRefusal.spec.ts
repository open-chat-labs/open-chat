import { ErrorCode, type SendMessageResponse } from "@shared";
import { describe, expect, test } from "vitest";
import { detailsChangedAfterHeld, promptsForRefusedRules, rulesRefusal } from "./rulesRefusal";

const error = (code: number): SendMessageResponse => ({ kind: "error", code, message: undefined });

describe("rulesRefusal", () => {
    test("a send refused for the chat's rules", () => {
        expect(rulesRefusal(error(ErrorCode.ChatRulesNotAccepted))).toBe("chat");
    });

    test("a send refused for the community's rules", () => {
        expect(rulesRefusal(error(ErrorCode.CommunityRulesNotAccepted))).toBe("community");
    });

    test("any other error isn't a refusal for the rules", () => {
        expect(rulesRefusal(error(ErrorCode.InitiatorNotAuthorized))).toBeUndefined();
    });

    test("a failure without a code isn't either", () => {
        expect(rulesRefusal({ kind: "failure" })).toBeUndefined();
    });
});

describe("detailsChangedAfterHeld", () => {
    test("just after the details held when the summary says they're as new", () => {
        expect(detailsChangedAfterHeld(10n, 10n)).toBe(11n);
        expect(detailsChangedAfterHeld(10n, 20n)).toBe(21n);
    });

    test("the summary's time when that's later", () => {
        expect(detailsChangedAfterHeld(30n, 20n)).toBe(30n);
    });

    test("the summary's time when no details are held", () => {
        expect(detailsChangedAfterHeld(30n, undefined)).toBe(30n);
    });
});

describe("promptsForRefusedRules", () => {
    test("asks, when the caller wants it, for a message that can be sent again", () => {
        expect(promptsForRefusedRules("prompt", "chat", true)).toBe(true);
        expect(promptsForRefusedRules("prompt", "community", true)).toBe(true);
    });

    test("fails as before when the caller doesn't ask (the old UIs)", () => {
        expect(promptsForRefusedRules("fail", "chat", true)).toBe(false);
        expect(promptsForRefusedRules("fail", "community", true)).toBe(false);
    });

    test("fails as before for a message that can't be sent again (a payment)", () => {
        expect(promptsForRefusedRules("prompt", "chat", false)).toBe(false);
    });

    test("doesn't ask when the send wasn't refused for the rules", () => {
        expect(promptsForRefusedRules("prompt", undefined, true)).toBe(false);
    });
});
