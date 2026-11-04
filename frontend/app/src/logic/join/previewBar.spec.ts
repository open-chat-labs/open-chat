import {
    ROLE_MEMBER,
    ROLE_NONE,
    type AccessGate,
    type CommunitySummary,
    type EnhancedAccessGate,
    type MultiUserChat,
} from "@client";
import { describe, expect, test } from "vitest";
import { previewBar, type PreviewBarInput } from "./previewBar";

const group = {
    kind: "group_chat",
    id: { kind: "group_chat", groupId: "g" },
    name: "Pixel Art",
    level: "group",
} as MultiUserChat;
const channel = {
    kind: "channel",
    id: { kind: "channel", communityId: "c", channelId: 1 },
    name: "general",
    level: "channel",
} as MultiUserChat;

function community(role: number, lapsed = false): CommunitySummary {
    return {
        kind: "community",
        id: { kind: "community", communityId: "c" },
        name: "DAO Builders",
        membership: { role, lapsed },
    } as CommunitySummary;
}

function enhanced(gate: AccessGate, level: EnhancedAccessGate["level"]): EnhancedAccessGate {
    return { ...gate, level, collectionName: "x", expiry: undefined };
}

const payment: AccessGate = { kind: "payment_gate", ledgerCanister: "l", amount: 1n, fee: 0n };
const diamond: AccessGate = { kind: "diamond_gate" };

function input(over: Partial<PreviewBarInput>): PreviewBarInput {
    return {
        chat: group,
        community: undefined,
        lapsed: false,
        gates: [],
        guest: false,
        originCommunityId: undefined,
        meets: () => false,
        ...over,
    };
}

describe("the preview bar", () => {
    test("a community being previewed is the community's bar: joining joins the community", () => {
        const c = community(ROLE_NONE);
        const bar = previewBar(input({ chat: channel, community: c }));

        expect(bar.target).toEqual({ kind: "community", community: c });
        expect(bar.name).toBe("DAO Builders");
        expect(bar.state).toBe("preview");
        // the design's own copy: Join community, its hint
        expect(bar.joinLabel).toBeUndefined();
        expect(bar.hint).toBeUndefined();
    });

    // cancelling a community preview entered from Explore goes back there
    test("Back says Back to Explore only for the community Explore opened", () => {
        const c = community(ROLE_NONE);
        expect(
            previewBar(input({ chat: channel, community: c, originCommunityId: "c" })).back,
        ).toBe("explore");
        expect(
            previewBar(input({ chat: channel, community: c, originCommunityId: "other" })).back,
        ).toBe("back");
        expect(previewBar(input({ chat: group, originCommunityId: "c" })).back).toBe("back");
    });

    test("a channel of a joined community, or a group, is the chat's own bar", () => {
        const bar = previewBar(input({ chat: channel, community: community(ROLE_MEMBER) }));

        expect(bar.target).toEqual({ kind: "group", chat: channel });
        expect(bar.name).toBe("general");
        expect(bar.joinLabel).toMatchObject({ key: "joinGroup", level: "channel" });
        expect(bar.hint).toMatchObject({ key: "access.previewHint" });
    });

    test("gates the user doesn't meet make it gated, with their requirements counted", () => {
        const gates = [
            enhanced(
                {
                    kind: "composite_gate",
                    operator: "and",
                    gates: [payment, diamond, { kind: "unique_person_gate" }],
                },
                "community",
            ),
            enhanced(payment, "channel"),
        ];
        const bar = previewBar(input({ chat: channel, community: community(ROLE_NONE), gates }));

        // the community's level only, less the suspended unique-person gate
        expect(bar.state).toBe("gated");
        expect(bar.requirements).toBe(2);
    });

    test("gates the user already meets leave it a plain preview", () => {
        const bar = previewBar(
            input({ gates: [enhanced(diamond, "group")], meets: (g) => g.kind === "diamond_gate" }),
        );

        expect(bar.state).toBe("preview");
        expect(bar.requirements).toBe(0);
    });

    test("a gated group says how many requirements in its own words", () => {
        const bar = previewBar(input({ gates: [enhanced(payment, "group")] }));

        expect(bar.state).toBe("gated");
        expect(bar.joinLabel).toBeUndefined();
        expect(bar.hint).toMatchObject({ key: "access.previewGatedHint", params: { count: 1 } });
    });

    test("a guest is asked to sign in, in the bar's own words", () => {
        const bar = previewBar(input({ guest: true, gates: [enhanced(payment, "group")] }));

        expect(bar.state).toBe("guest");
        expect(bar.joinLabel).toBeUndefined();
        expect(bar.hint).toBeUndefined();
    });

    // a locked gate disables Join and labels it access.lockedGate
    test("a locked gate disables Join and labels it Locked", () => {
        const bar = previewBar(input({ gates: [enhanced({ kind: "locked_gate" }, "group")] }));

        expect(bar.locked).toBe(true);
        expect(bar.state).toBe("preview");
        expect(bar.joinLabel).toMatchObject({ key: "access.lockedGate" });
    });

    // lapsed labels it access.lapsed.rejoin; a lapsed member is still a member, so no Back
    test("a lapsed member rejoins, with no Back", () => {
        const bar = previewBar(input({ chat: channel, community: community(ROLE_MEMBER, true) }));

        expect(bar.target.kind).toBe("community");
        expect(bar.joinLabel).toMatchObject({ key: "access.lapsed.rejoin", level: "community" });
        expect(bar.back).toBe("none");

        const lapsedGroup = previewBar(input({ lapsed: true }));
        expect(lapsedGroup.joinLabel).toMatchObject({
            key: "access.lapsed.rejoin",
            level: "group",
        });
        expect(lapsedGroup.back).toBe("none");
    });
});
