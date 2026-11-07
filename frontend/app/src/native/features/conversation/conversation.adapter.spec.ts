import { describe, expect, test } from "vitest";
import {
    callEventProps,
    disappearChoice,
    disappearItemId,
    headerMenuItems,
    type HeaderMenuState,
} from "./conversation.adapter";

const label = (id: string) => `[${id}]`;

const dm: HeaderMenuState = {
    kind: "user",
    muted: false,
    favourite: false,
    isBot: false,
    disappearAfter: undefined,
    actions: ["block", "delete"],
};

describe("the conversation header's menu", () => {
    test("a DM: search, details, mute, favourite, disappearing messages, then block and delete", () => {
        const items = headerMenuItems(dm, label);
        expect(items.map((i) => i.id)).toEqual([
            "search",
            "details",
            "mute",
            "favourite",
            "disappearing",
            "block",
            "delete",
        ]);
        expect(items.find((i) => i.id === "block")).toMatchObject({ danger: true, separator: true });
        expect(items.find((i) => i.id === "delete")).toMatchObject({ danger: true });
        expect(items.find((i) => i.id === "delete")?.separator).toBeUndefined();
    });

    test("disappearing messages ticks the duration set, Off when they don't disappear", () => {
        const choices = (after: number | undefined) =>
            headerMenuItems({ ...dm, disappearAfter: after }, label)
                .find((i) => i.id === "disappearing")
                ?.submenu?.items.filter((i) => i.selected)
                .map((i) => i.id);
        expect(choices(undefined)).toEqual([disappearItemId("off")]);
        expect(choices(24 * 60 * 60 * 1000)).toEqual([disappearItemId("day")]);
        expect(disappearChoice(disappearItemId("week"))?.ms).toBe(7 * 24 * 60 * 60 * 1000);
        expect(disappearChoice("mute")).toBeUndefined();
    });

    test("a group: unmute and unfavourite when set, leave, and no disappearing messages", () => {
        const items = headerMenuItems(
            { ...dm, kind: "group", muted: true, favourite: true, actions: ["leave"] },
            label,
        );
        expect(items.map((i) => i.id)).toEqual([
            "search",
            "details",
            "unmute",
            "unfavourite",
            "leave",
        ]);
        expect(items[4]).toMatchObject({ label: "[leave]", icon: "exit", danger: true });
    });

    test("a bot's DM can't be muted or set to disappear", () => {
        const items = headerMenuItems({ ...dm, isBot: true, actions: [] }, label);
        expect(items.map((i) => i.id)).toEqual(["search", "details", "favourite"]);
    });
});

describe("an ended or missed call", () => {
    test("the user's own reads as theirs, anyone else's by name", () => {
        expect(callEventProps("missed", "voice", { mine: true }, "", "10:00").startedBy).toBe(
            "You",
        );
        expect(
            callEventProps("ended", "video", { mine: false, name: "Ann" }, "4:12", "10:00"),
        ).toEqual({
            state: "ended",
            media: "video",
            startedBy: "Ann",
            duration: "4:12",
            time: "10:00",
        });
    });
});
