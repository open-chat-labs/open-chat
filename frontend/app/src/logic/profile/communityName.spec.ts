import type { SetMemberDisplayNameResponse } from "@client";
import { describe, expect, test, vi } from "vitest";
import { memberDisplayNameOf, saveCommunityName } from "./communityName";

function client(resp: SetMemberDisplayNameResponse = { kind: "success" }) {
    return { setMemberDisplayName: vi.fn(async () => resp) };
}

describe("a community name", () => {
    test("clearing it sends no name (removes it), not an empty string", () => {
        expect(memberDisplayNameOf(null)).toBeUndefined();
        expect(memberDisplayNameOf("")).toBeUndefined();
        expect(memberDisplayNameOf("Jules")).toBe("Jules");
        expect(memberDisplayNameOf("   ")).toBeUndefined();
        expect(memberDisplayNameOf(" Jules ")).toBe("Jules");
    });

    test("is set in the community without the spaces around it", async () => {
        const c = client();
        expect(await saveCommunityName(c, "c1", " Jules ")).toEqual({ kind: "saved" });
        expect(c.setMemberDisplayName).toHaveBeenCalledWith(
            { kind: "community", communityId: "c1" },
            "Jules",
        );
    });

    test("cleared, is removed", async () => {
        const c = client();
        await saveCommunityName(c, "c1", "  ");
        expect(c.setMemberDisplayName).toHaveBeenCalledWith(
            { kind: "community", communityId: "c1" },
            undefined,
        );
    });

    test("one the backend would turn down isn't sent", async () => {
        const c = client();
        expect(await saveCommunityName(c, "c1", "J")).toEqual({
            kind: "rejected",
            message: "register.displayNameInvalid",
        });
        expect(c.setMemberDisplayName).not.toHaveBeenCalled();
    });

    test("offline, it fails", async () => {
        expect(await saveCommunityName(client({ kind: "offline" }), "c1", "Jules")).toEqual({
            kind: "failed",
        });
    });
});
