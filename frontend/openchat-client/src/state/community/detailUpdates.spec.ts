import type { CommunityIdentifier, VersionedRules } from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CommunityDetailsUpdatesManager } from "./detailUpdates";

const communityId: CommunityIdentifier = { kind: "community", communityId: "abc" };
const rules = (text: string, enabled: boolean): VersionedRules => ({ text, enabled, version: 0 });

describe("community details local updates: rules", () => {
    let updates: CommunityDetailsUpdatesManager;

    beforeEach(() => {
        vi.useFakeTimers();
        updates = new CommunityDetailsUpdatesManager();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const held = () => updates.rules.value.get(communityId);

    test("an update's rules are held until its undo runs", () => {
        updates.updateRules(communityId, rules("a", true));
        expect(held()).toEqual(rules("a", true));
        vi.runAllTimers();
        expect(held()).toBeUndefined();
    });

    test("two updates inside the timeout leave nothing behind once both undos have run", () => {
        updates.updateRules(communityId, rules("a", false));
        vi.advanceTimersByTime(10_000);
        updates.updateRules(communityId, rules("b", true));
        // the first update's undo leaves the second's rules alone
        vi.advanceTimersByTime(50_000);
        expect(held()).toEqual(rules("b", true));
        // and the second's doesn't put the first's back
        vi.runAllTimers();
        expect(held()).toBeUndefined();
    });

    test("undoing by hand takes off only the rules still held", () => {
        const undoFirst = updates.updateRules(communityId, rules("a", false));
        updates.updateRules(communityId, rules("b", true));
        undoFirst();
        expect(held()).toEqual(rules("b", true));
    });
});
