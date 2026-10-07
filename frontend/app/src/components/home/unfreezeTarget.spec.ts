import type { CommunityIdentifier, GroupChatIdentifier } from "@client";
import { describe, expect, it } from "vitest";
import { unfreezeTarget } from "./unfreezeTarget";

const groupId: GroupChatIdentifier = { kind: "group_chat", groupId: "group" };
const communityId: CommunityIdentifier = { kind: "community", communityId: "community" };

describe("unfreezeTarget", () => {
    /** Invariant: unfreezing a group chat never unfreezes a community, even with one selected. */
    it("unfreezes only the group for a group chat", () => {
        expect(unfreezeTarget({ kind: "group_chat", id: groupId }, communityId)).toEqual({
            kind: "group",
            id: groupId,
        });
    });

    it("unfreezes the selected community for a channel", () => {
        expect(unfreezeTarget({ kind: "channel" }, communityId)).toEqual({
            kind: "community",
            id: communityId,
        });
    });

    it("unfreezes nothing for a channel with no selected community", () => {
        expect(unfreezeTarget({ kind: "channel" }, undefined)).toBeUndefined();
    });
});
