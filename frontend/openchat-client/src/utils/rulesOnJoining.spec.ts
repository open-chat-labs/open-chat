import type { VersionedRules } from "@shared";
import { describe, expect, test } from "vitest";
import {
    noRulesAgreed,
    RULES_AGREED_MAX_AGE_MS,
    rulesAgreedOnJoining,
    rulesToAccept,
    unexpiredRulesAgreed,
    withoutCommunityRulesAgreed,
    withoutRulesAgreed,
    withRulesAgreed,
    type RulesAtSend,
} from "./rulesOnJoining";

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

    test("a set with no text isn't kept, and others are left as they were", () => {
        const before = withRulesAgreed(noRulesAgreed(), { key: "g", text: "group" }, undefined, 1);
        const agreed = withRulesAgreed(
            before,
            { key: "c_1", text: undefined },
            { id: "c", text: "community" },
            now,
        );
        expect([...agreed.chats.keys()]).toEqual(["g"]);
        expect(agreed.communities.get("c")?.text).toBe("community");
        // the value it started from isn't changed
        expect(before.communities.size).toBe(0);
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
});

const rules = (text: string, version = 3): VersionedRules => ({ text, enabled: true, version });
const disabled: VersionedRules = { text: "old rules", enabled: false, version: 2 };

const none: RulesAtSend = { rules: undefined, accepted: false, agreedOnJoining: undefined };

describe("rulesToAccept", () => {
    test("none when neither set is to be accepted", () => {
        expect(rulesToAccept(undefined, undefined)).toBeUndefined();
    });

    test("the chat's, the community's or both", () => {
        expect(rulesToAccept("chat", undefined)).toEqual({ chat: "chat", community: undefined });
        expect(rulesToAccept(undefined, "community")).toEqual({
            chat: undefined,
            community: "community",
        });
        expect(rulesToAccept("chat", "community")).toEqual({
            chat: "chat",
            community: "community",
        });
    });
});

describe("rulesAgreedOnJoining", () => {
    test("the version of the chat's rules the user agreed to as they joined", () => {
        expect(
            rulesAgreedOnJoining(
                { rules: rules("be nice"), accepted: false, agreedOnJoining: "be nice" },
                none,
            ),
        ).toEqual({ chat: 3, community: undefined });
    });

    test("a channel's and its community's, both agreed to", () => {
        expect(
            rulesAgreedOnJoining(
                { rules: rules("channel", 1), accepted: false, agreedOnJoining: "channel" },
                { rules: rules("community", 5), accepted: false, agreedOnJoining: "community" },
            ),
        ).toEqual({ chat: 1, community: 5 });
    });

    test("rules already accepted go with the send, as the prompt's acceptance has them", () => {
        expect(
            rulesAgreedOnJoining(
                { rules: rules("channel", 1), accepted: false, agreedOnJoining: "channel" },
                { rules: rules("community", 5), accepted: true, agreedOnJoining: undefined },
            ),
        ).toEqual({ chat: 1, community: 5 });
    });

    test("rules that are disabled aren't accepted", () => {
        expect(
            rulesAgreedOnJoining(
                { rules: disabled, accepted: false, agreedOnJoining: undefined },
                { rules: rules("community"), accepted: false, agreedOnJoining: "community" },
            ),
        ).toEqual({ chat: undefined, community: 3 });
    });

    test("none when rules changed since the user agreed to them: they're asked again", () => {
        expect(
            rulesAgreedOnJoining(
                { rules: rules("be nicer", 4), accepted: false, agreedOnJoining: "be nice" },
                none,
            ),
        ).toBeUndefined();
    });

    test("none when a set still to be accepted wasn't agreed to as the user joined", () => {
        expect(
            rulesAgreedOnJoining(
                { rules: rules("channel"), accepted: false, agreedOnJoining: "channel" },
                { rules: rules("community"), accepted: false, agreedOnJoining: undefined },
            ),
        ).toBeUndefined();
        expect(
            rulesAgreedOnJoining(
                { rules: rules("be nice"), accepted: false, agreedOnJoining: undefined },
                none,
            ),
        ).toBeUndefined();
    });

    test("none when nothing is to be accepted", () => {
        expect(
            rulesAgreedOnJoining(
                { rules: rules("be nice"), accepted: true, agreedOnJoining: "be nice" },
                none,
            ),
        ).toBeUndefined();
    });
});
