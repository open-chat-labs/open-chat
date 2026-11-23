import type { VersionedRules } from "@shared";
import { describe, expect, test } from "vitest";
import { rulesAgreedOnJoining, rulesToAccept, type RulesAtSend } from "./rulesOnJoining";

const rules = (text: string, version = 3): VersionedRules => ({ text, enabled: true, version });
const disabled: VersionedRules = { text: "old rules", enabled: false, version: 2 };

const none: RulesAtSend = { rules: undefined, accepted: false, agreedOnJoining: undefined };

describe("rulesToAccept", () => {
    const chat = { name: "#general", text: "channel" };
    const community = { name: "Book Club", text: "community" };

    test("none when neither set is to be accepted", () => {
        expect(rulesToAccept(undefined, undefined)).toBeUndefined();
    });

    test("the chat's, the community's or both", () => {
        expect(rulesToAccept(chat, undefined)).toEqual({ chat, community: undefined });
        expect(rulesToAccept(undefined, community)).toEqual({ chat: undefined, community });
        expect(rulesToAccept(chat, community)).toEqual({ chat, community });
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
