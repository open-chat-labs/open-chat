import type { GroupChatIdentifier, VersionedRules } from "@client";
import { describe, expect, test } from "vitest";
import { SAVED_RULES_MS, SavedRules } from "./savedRules.svelte";

const chatId: GroupChatIdentifier = { kind: "group_chat", groupId: "g" };
const other: GroupChatIdentifier = { kind: "group_chat", groupId: "h" };
const rules = (text: string, enabled: boolean): VersionedRules => ({ text, enabled, version: 0 });

describe("the rules the native pages show", () => {
    test("the server's, until a save here", () => {
        const saved = new SavedRules();
        expect(saved.shown(chatId, rules("server", false), 0)).toEqual(rules("server", false));
        expect(saved.shown(chatId, undefined, 0)).toBeUndefined();
    });

    // the device's bug: off then on within a minute showed off after leaving and coming back
    test("the latest save's for the minute after it, whatever the server's say meanwhile", () => {
        const saved = new SavedRules();
        saved.remember(chatId, rules("a", false), 0);
        saved.remember(chatId, rules("b", true), 10_000);
        expect(saved.shown(chatId, rules("a", false), 20_000)).toEqual(rules("b", true));
        expect(saved.shown(other, rules("x", false), 20_000)).toEqual(rules("x", false));
    });

    test("the server's again once the minute is out", () => {
        const saved = new SavedRules();
        saved.remember(chatId, rules("b", true), 0);
        expect(saved.shown(chatId, rules("b", true), SAVED_RULES_MS)).toEqual(rules("b", true));
        expect(saved.shown(chatId, rules("later", true), SAVED_RULES_MS)).toEqual(
            rules("later", true),
        );
    });
});
