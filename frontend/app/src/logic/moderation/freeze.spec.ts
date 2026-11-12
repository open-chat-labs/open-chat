import { i18nKey, type CommunityIdentifier, type GroupChatIdentifier } from "@client";
import { describe, expect, it, vi } from "vitest";
import {
    FREEZE_REASON_MAX_LENGTH,
    freeze,
    freezeConfirmText,
    freezeItem,
    freezeLabel,
    freezeReason,
    freezeTarget,
    setFrozen,
    unfreeze,
    type FreezeClient,
} from "./freeze";

const groupId: GroupChatIdentifier = { kind: "group_chat", groupId: "group" };
const communityId: CommunityIdentifier = { kind: "community", communityId: "community" };

describe("freezeTarget", () => {
    it("acts on the group for a group chat", () => {
        expect(freezeTarget(groupId)).toEqual({ kind: "group", id: groupId });
    });

    /** Invariant: a channel is never frozen on its own: freezing it freezes its community. */
    it("acts on the channel's own community for a channel", () => {
        expect(freezeTarget({ kind: "channel", communityId: "community", channelId: 7 })).toEqual({
            kind: "community",
            id: communityId,
        });
    });
});

function fakeClient(answer: boolean) {
    return {
        freezeGroup: vi.fn(() => Promise.resolve(answer)),
        unfreezeGroup: vi.fn(() => Promise.resolve(answer)),
        freezeCommunity: vi.fn(() => Promise.resolve(answer)),
        unfreezeCommunity: vi.fn(() => Promise.resolve(answer)),
    } satisfies FreezeClient;
}

describe("setFrozen", () => {
    it("freezes a group with no reason, and says it's frozen", async () => {
        const client = fakeClient(true);
        const outcome = await setFrozen(client, { kind: "group", id: groupId }, true);
        expect(client.freezeGroup).toHaveBeenCalledWith(groupId, undefined);
        expect(outcome).toEqual({ kind: "success", message: i18nKey("chatFrozen") });
    });

    it("unfreezes a group, and says it's unfrozen", async () => {
        const client = fakeClient(true);
        const outcome = await setFrozen(client, { kind: "group", id: groupId }, false);
        expect(client.unfreezeGroup).toHaveBeenCalledWith(groupId);
        expect(outcome).toEqual({ kind: "success", message: i18nKey("chatUnfrozen") });
    });

    it("says which failed", async () => {
        const client = fakeClient(false);
        expect(await setFrozen(client, { kind: "group", id: groupId }, false)).toEqual({
            kind: "failed",
            message: i18nKey("failedToUnfreezeGroup"),
        });
        expect(await setFrozen(client, { kind: "community", id: communityId }, true)).toEqual({
            kind: "failed",
            message: i18nKey("failedToFreezeCommunity"),
        });
    });

    it("freezes and unfreezes a community, saying so", async () => {
        const client = fakeClient(true);
        const target = { kind: "community" as const, id: communityId };
        expect(await setFrozen(client, target, true)).toEqual({
            kind: "success",
            message: i18nKey("communityFrozen"),
        });
        expect(client.freezeCommunity).toHaveBeenCalledWith(communityId, undefined);
        expect(await setFrozen(client, target, false)).toEqual({
            kind: "success",
            message: i18nKey("communityUnfrozen"),
        });
        expect(client.unfreezeCommunity).toHaveBeenCalledWith(communityId);
    });
});

describe("freezeLabel", () => {
    it("offers the other state, naming the target", () => {
        expect(freezeLabel("group", false)).toEqual(i18nKey("freezeGroup"));
        expect(freezeLabel("group", true)).toEqual(i18nKey("unfreezeGroup"));
        expect(freezeLabel("community", false)).toEqual(i18nKey("freezeCommunity"));
        expect(freezeLabel("community", true)).toEqual(i18nKey("unfreezeCommunity"));
    });
});

describe("freeze", () => {
    it("freezes with the moderator's reason, naming what's frozen for the Undo toast", async () => {
        const client = fakeClient(true);
        expect(await freeze(client, { kind: "group", id: groupId }, "Book Club", "Spam")).toEqual({
            kind: "frozen",
            message: i18nKey("moderationToast.frozen", { name: "Book Club" }),
        });
        expect(client.freezeGroup).toHaveBeenCalledWith(groupId, "Spam");
        await freeze(client, { kind: "community", id: communityId }, "Seeds", undefined);
        expect(client.freezeCommunity).toHaveBeenCalledWith(communityId, undefined);
    });

    it("says it failed, naming it, for the dialog to show", async () => {
        const client = fakeClient(false);
        expect(await freeze(client, { kind: "community", id: communityId }, "Seeds", "x")).toEqual({
            kind: "failed",
            message: i18nKey("moderationToast.freezeFailed", { name: "Seeds" }),
        });
    });
});

describe("unfreeze", () => {
    it("says it's on its way, and calls nothing until it's run", () => {
        const client = fakeClient(true);
        const action = unfreeze(client, { kind: "group", id: groupId }, "Book Club");
        expect(action.pending).toEqual(
            i18nKey("moderationToast.unfreezing", { name: "Book Club" }),
        );
        expect(client.unfreezeGroup).not.toHaveBeenCalled();
    });

    it("unfreezes a group or a community, naming it", async () => {
        const client = fakeClient(true);
        expect(await unfreeze(client, { kind: "group", id: groupId }, "Book Club").run()).toEqual({
            kind: "success",
            message: i18nKey("moderationToast.unfrozen", { name: "Book Club" }),
        });
        expect(client.unfreezeGroup).toHaveBeenCalledWith(groupId);
        await unfreeze(client, { kind: "community", id: communityId }, "Seeds").run();
        expect(client.unfreezeCommunity).toHaveBeenCalledWith(communityId);
    });

    it("says it failed, naming it", async () => {
        const client = fakeClient(false);
        expect(
            await unfreeze(client, { kind: "community", id: communityId }, "Seeds").run(),
        ).toEqual({
            kind: "failed",
            message: i18nKey("moderationToast.unfreezeFailed", { name: "Seeds" }),
        });
    });
});

describe("freezeItem", () => {
    /** Invariant: freezing is never done straight from the menu: the moderator confirms it first. */
    it("asks to confirm freezing, and freezes nothing yet", () => {
        const client = fakeClient(true);
        const group = { kind: "group" as const, id: groupId };
        const community = { kind: "community" as const, id: communityId };
        expect(freezeItem(client, group, "Book Club", true)).toEqual({
            kind: "confirm",
            target: group,
        });
        expect(freezeItem(client, community, "Seeds", true)).toEqual({
            kind: "confirm",
            target: community,
        });
        expect(client.freezeGroup).not.toHaveBeenCalled();
        expect(client.freezeCommunity).not.toHaveBeenCalled();
    });

    it("unfreezes without asking, in a pending toast", async () => {
        const client = fakeClient(true);
        const item = freezeItem(client, { kind: "community", id: communityId }, "Seeds", false);
        if (item.kind !== "unfreeze") throw new Error("expected unfreeze");
        expect(item.action.pending).toEqual(
            i18nKey("moderationToast.unfreezing", { name: "Seeds" }),
        );
        await item.action.run();
        expect(client.unfreezeCommunity).toHaveBeenCalledWith(communityId);
    });
});

describe("freezeConfirmText", () => {
    it("asks about the group", () => {
        expect(freezeConfirmText({ kind: "group", id: groupId }, "Book Club")).toEqual({
            title: i18nKey("freezeConfirm.groupTitle"),
            body: i18nKey("freezeConfirm.groupBody"),
            reasonHint: i18nKey("freezeConfirm.groupReasonHint"),
        });
    });

    it("names the community whose channels all freeze", () => {
        expect(freezeConfirmText({ kind: "community", id: communityId }, "Seeds")).toEqual({
            title: i18nKey("freezeConfirm.communityTitle"),
            body: i18nKey("freezeConfirm.communityBody", { name: "Seeds" }),
            reasonHint: i18nKey("freezeConfirm.communityReasonHint"),
        });
    });
});

describe("freezeReason", () => {
    it("trims the reason", () => {
        expect(freezeReason("  Spam links \n")).toEqual({ kind: "ok", reason: "Spam links" });
    });

    it("gives none for a blank reason", () => {
        expect(freezeReason("")).toEqual({ kind: "ok", reason: undefined });
        expect(freezeReason("   \n ")).toEqual({ kind: "ok", reason: undefined });
    });

    it("takes the longest reason, counted after trimming", () => {
        const longest = "x".repeat(FREEZE_REASON_MAX_LENGTH);
        expect(freezeReason(` ${longest} `)).toEqual({ kind: "ok", reason: longest });
    });

    it("refuses a longer one", () => {
        expect(freezeReason("x".repeat(FREEZE_REASON_MAX_LENGTH + 1))).toEqual({
            kind: "too_long",
        });
    });
});
