import { ErrorCode, type SendMessageResponse } from "@shared";
import { describe, expect, test } from "vitest";
import {
    nextRulesRefusedResend,
    promptsForRefusedRules,
    resendsOnceRulesAccepted,
    rulesRefusal,
} from "./rulesRefusal";

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

describe("resendsOnceRulesAccepted", () => {
    test("the new UIs send a message refused for the rules again once they're accepted", () => {
        expect(resendsOnceRulesAccepted("prompt")).toBe(true);
        expect(resendsOnceRulesAccepted("asked")).toBe(true);
    });

    test("the old UIs leave it for Retry", () => {
        expect(resendsOnceRulesAccepted("fail")).toBe(false);
    });
});

describe("nextRulesRefusedResend", () => {
    const m = (id: number, timestamp: number, index: number) => ({
        messageId: BigInt(id),
        timestamp: BigInt(timestamp),
        index,
    });

    test("the oldest written first, then the lowest index", () => {
        expect(nextRulesRefusedResend([m(2, 20, 5), m(1, 10, 6), m(3, 10, 4)], new Set())).toEqual(
            m(3, 10, 4),
        );
    });

    test("once each: not one this run has sent", () => {
        expect(nextRulesRefusedResend([m(1, 10, 1), m(2, 20, 2)], new Set([1n]))).toEqual(
            m(2, 20, 2),
        );
        expect(nextRulesRefusedResend([m(1, 10, 1)], new Set([1n]))).toBeUndefined();
    });
});
