import { ROLE_MEMBER, ROLE_NONE, type AccessGate, type MemberRole } from "@shared";
import { describe, expect, test } from "vitest";
import { isPrivateCommunityPreview } from "./community";

function community(joined: boolean, isPublic: boolean, gate: AccessGate, lapsed = false) {
    return {
        membership: { role: (joined ? ROLE_MEMBER : ROLE_NONE) as MemberRole, lapsed },
        public: isPublic,
        gateConfig: { gate, expiry: undefined },
    };
}

// Invariant: a community the user isn't an active member of shows its channels' messages only
// when it is public and ungated
describe("isPrivateCommunityPreview", () => {
    test("a private community not joined hides its messages", () => {
        expect(isPrivateCommunityPreview(community(false, false, { kind: "no_gate" }))).toBe(true);
    });

    test("a gated public community not joined hides its messages", () => {
        expect(isPrivateCommunityPreview(community(false, true, { kind: "diamond_gate" }))).toBe(
            true,
        );
    });

    test("a lapsed member counts as not joined", () => {
        expect(isPrivateCommunityPreview(community(true, false, { kind: "no_gate" }, true))).toBe(
            true,
        );
    });

    test("a public ungated community, a joined one or none at all shows messages", () => {
        expect(isPrivateCommunityPreview(community(false, true, { kind: "no_gate" }))).toBe(false);
        expect(isPrivateCommunityPreview(community(true, false, { kind: "diamond_gate" }))).toBe(
            false,
        );
        expect(isPrivateCommunityPreview(undefined)).toBe(false);
    });

    test("a suspended unique person gate counts as no gate", () => {
        const gate = { kind: "unique_person_gate" } as AccessGate;
        expect(isPrivateCommunityPreview(community(false, true, gate))).toBe(false);
    });
});
