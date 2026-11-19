import {
    ROLE_MEMBER,
    ROLE_NONE,
    type AccessGate,
    type CommunitySummary,
    type EnhancedAccessGate,
    type MultiUserChat,
} from "@client";
import { previewBar, type PreviewBarInput } from "@src/logic/join/previewBar";
import { describe, expect, test } from "vitest";
import { joinBarView } from "./joinBar.adapter";

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

function community(role: number): CommunitySummary {
    return {
        kind: "community",
        id: { kind: "community", communityId: "c" },
        name: "DAO Builders",
        membership: { role, lapsed: false },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
    } as CommunitySummary;
}

function groupGate(gate: AccessGate): EnhancedAccessGate {
    return { ...gate, level: "group", collectionName: "x", expiry: undefined };
}
const locked = groupGate({ kind: "locked_gate" });
const diamond = groupGate({ kind: "diamond_gate" });

function bar(over: Partial<PreviewBarInput>) {
    const input: PreviewBarInput = {
        chat: group,
        community: undefined,
        lapsed: false,
        gates: [],
        guest: false,
        origin: undefined,
        meets: () => false,
        ...over,
    };
    return { bar: previewBar(input), view: joinBarView(previewBar(input), input.chat) };
}

describe("the join bar (#10375)", () => {
    test("invariant 1: the bar names what its Join joins: the community while it's previewed, else the channel or group", () => {
        const ofCommunity = bar({ chat: channel, community: community(ROLE_NONE) });
        expect(ofCommunity.view.label).toMatchObject({ key: "joinGroup", level: "community" });
        expect(ofCommunity.view.note).toMatchObject({
            key: "native.join.previewingChannel",
            params: { channel: "general", community: "DAO Builders" },
        });

        const ofChannel = bar({ chat: channel, community: community(ROLE_MEMBER) });
        expect(ofChannel.bar.target).toEqual({ kind: "group", chat: channel });
        expect(ofChannel.view.label).toMatchObject({ key: "joinGroup", level: "channel" });
        expect(ofChannel.view.note).toMatchObject({ key: "native.join.notInChannel" });

        const ofGroup = bar({});
        expect(ofGroup.view.label).toMatchObject({ key: "joinGroup", level: "group" });
        expect(ofGroup.view.disabled).toBe(false);
    });

    test("invariant 2: a locked chat's Join can't be pressed, and one with requirements offers Review and join", () => {
        const lockedGroup = bar({ gates: [locked] });
        expect(lockedGroup.view).toMatchObject({
            label: { key: "access.lockedGate" },
            icon: "lock",
            disabled: true,
        });

        // the client answers its Join with the requirements, which the sheet shows first
        expect(bar({ gates: [diamond] }).view).toMatchObject({
            label: { key: "native.join.review" },
            icon: "lock",
            disabled: false,
        });
        // met already: a plain Join
        expect(bar({ gates: [diamond], meets: () => true }).view.label).toMatchObject({
            key: "joinGroup",
        });
    });
});
