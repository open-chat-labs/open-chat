import { describe, expect, test } from "vitest";
import {
    applyRulesAgreedChange,
    noRulesAgreed,
    RULES_AGREED_MAX_AGE_MS,
    unexpiredRulesAgreed,
    withoutCommunityRulesAgreed,
    withoutRulesAgreed,
    withRulesAgreed,
} from "./rulesAgreed";

describe("keeping the rules agreed to on joining", () => {
    const now = 1_000_000_000_000;

    test("a channel's and its community's are kept with when they were agreed to", () => {
        const agreed = withRulesAgreed(
            noRulesAgreed(),
            { key: "c_1", text: "channel" },
            { id: "c", text: "community" },
            now,
        );
        expect(agreed.chats.get("c_1")).toEqual({ text: "channel", agreedAt: now });
        expect(agreed.communities.get("c")).toEqual({ text: "community", agreedAt: now });
    });

    test("agreeing leaves the others as they were, and the value it started from alone", () => {
        const before = withRulesAgreed(noRulesAgreed(), { key: "g", text: "group" }, undefined, 1);
        const agreed = withRulesAgreed(before, undefined, { id: "c", text: "community" }, now);
        expect([...agreed.chats.keys()]).toEqual(["g"]);
        expect(agreed.communities.get("c")?.text).toBe("community");
        expect(before.communities.size).toBe(0);
        expect(withRulesAgreed(agreed, undefined, undefined, now)).toBe(agreed);
    });

    test("forgetting drops the chat's and the community's, and nothing else", () => {
        const agreed = withRulesAgreed(
            withRulesAgreed(noRulesAgreed(), { key: "g", text: "group" }, undefined, now),
            { key: "c_1", text: "channel" },
            { id: "c", text: "community" },
            now,
        );
        const forgotten = withoutRulesAgreed(agreed, "c_1", "c");
        expect([...forgotten.chats.keys()]).toEqual(["g"]);
        expect(forgotten.communities.size).toBe(0);
    });

    test("forgetting what isn't there gives the same value, so nothing is written", () => {
        const agreed = withRulesAgreed(
            noRulesAgreed(),
            { key: "g", text: "group" },
            undefined,
            now,
        );
        expect(withoutRulesAgreed(agreed, "other", "community")).toBe(agreed);
        expect(withoutRulesAgreed(agreed, undefined, undefined)).toBe(agreed);
    });

    test("leaving a community forgets it and its channels", () => {
        const agreed = withRulesAgreed(
            withRulesAgreed(
                withRulesAgreed(
                    noRulesAgreed(),
                    { key: "c_1", text: "1" },
                    { id: "c", text: "c" },
                    now,
                ),
                { key: "c_2", text: "2" },
                undefined,
                now,
            ),
            { key: "d_1", text: "other" },
            { id: "d", text: "d" },
            now,
        );
        const left = withoutCommunityRulesAgreed(agreed, "c");
        expect([...left.chats.keys()]).toEqual(["d_1"]);
        expect([...left.communities.keys()]).toEqual(["d"]);
        expect(withoutCommunityRulesAgreed(left, "c")).toBe(left);
    });

    test("agreements older than 30 days are dropped", () => {
        const agreed = withRulesAgreed(
            withRulesAgreed(
                noRulesAgreed(),
                { key: "old", text: "old" },
                { id: "x", text: "x" },
                now,
            ),
            { key: "new", text: "new" },
            undefined,
            now + RULES_AGREED_MAX_AGE_MS - 1,
        );
        const kept = unexpiredRulesAgreed(agreed, now + RULES_AGREED_MAX_AGE_MS);
        expect([...kept.chats.keys()]).toEqual(["new"]);
        expect(kept.communities.size).toBe(0);
    });

    test("with none expired, the same value, so nothing is written", () => {
        const agreed = withRulesAgreed(
            noRulesAgreed(),
            { key: "g", text: "group" },
            undefined,
            now,
        );
        expect(unexpiredRulesAgreed(agreed, now + 1)).toBe(agreed);
    });
    test("a change is made, and what's expired dropped, in one go", () => {
        const agreed = withRulesAgreed(
            noRulesAgreed(),
            { key: "old", text: "old" },
            undefined,
            now,
        );
        const later = now + RULES_AGREED_MAX_AGE_MS;
        const next = applyRulesAgreedChange(
            agreed,
            { kind: "agreed", chat: { key: "new", text: "new" }, community: undefined },
            later,
        );
        expect([...next.chats.keys()]).toEqual(["new"]);
        expect(applyRulesAgreedChange(next, { kind: "read" }, later)).toBe(next);
        expect(
            applyRulesAgreedChange(
                next,
                { kind: "forget", chatKey: "new", communityId: undefined },
                later,
            ).chats.size,
        ).toBe(0);
        expect(
            applyRulesAgreedChange(next, { kind: "forget_community", communityId: "x" }, later),
        ).toBe(next);
    });
});
