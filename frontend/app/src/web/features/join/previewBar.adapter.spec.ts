import { i18nKey, type MultiUserChat, type ResourceKey } from "@client";
import { describe, expect, test } from "vitest";
import type { PreviewBar } from "@src/logic/join/previewBar";
import { previewBarProps } from "./previewBar.adapter";

const chat = { kind: "group_chat", name: "Pixel Art" } as MultiUserChat;
const text = (key: ResourceKey) => `t:${key.key}`;

function bar(over: Partial<PreviewBar>): PreviewBar {
    return {
        target: { kind: "group", chat },
        name: "Pixel Art",
        community: undefined,
        state: "preview",
        requirements: 0,
        hint: undefined,
        joinLabel: undefined,
        back: "explore",
        locked: false,
        ...over,
    };
}

describe("the preview bar's props", () => {
    test("keep the bar's own copy where the preview says nothing of its own", () => {
        expect(previewBarProps(bar({}), "a.png", text)).toEqual({
            community: "Pixel Art",
            avatarUrl: "a.png",
            state: "preview",
            requirements: 0,
            hint: undefined,
            joinLabel: undefined,
            backLabel: undefined,
            showBack: true,
            joinDisabled: false,
        });
    });

    test("say Back for a preview not opened from Explore, and no Back for a lapsed member", () => {
        expect(previewBarProps(bar({ back: "back" }), "", text)).toMatchObject({
            backLabel: "t:back",
            showBack: true,
        });
        expect(previewBarProps(bar({ back: "none" }), "", text)).toMatchObject({
            showBack: false,
        });
    });

    test("translate the preview's own labels, and lock Join", () => {
        const locked = bar({
            locked: true,
            joinLabel: i18nKey("access.lockedGate"),
            hint: i18nKey("access.lockedGateInfo"),
        });
        expect(previewBarProps(locked, "", text)).toMatchObject({
            joinLabel: "t:access.lockedGate",
            hint: "t:access.lockedGateInfo",
            joinDisabled: true,
        });
    });
});
