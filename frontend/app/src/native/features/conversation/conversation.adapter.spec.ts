import { describe, expect, test } from "vitest";
import {
    callEventProps,
    headerMenuItems,
    listWaiting,
    type HeaderMenuState,
} from "./conversation.adapter";

const label = (id: string) => `[${id}]`;

const dm: HeaderMenuState = {
    kind: "user",
    muted: false,
    favourite: false,
    isBot: false,
    actions: ["block", "delete"],
};

describe("the conversation header's menu", () => {
    // a DM's disappearing messages are a switch on its details (N6), as in the current app
    test("a DM: search, details, mute, favourite, then block and delete", () => {
        const items = headerMenuItems(dm, label);
        expect(items.map((i) => i.id)).toEqual([
            "search",
            "details",
            "mute",
            "favourite",
            "block",
            "delete",
        ]);
        expect(items.find((i) => i.id === "block")).toMatchObject({ danger: true, separator: true });
        expect(items.find((i) => i.id === "delete")).toMatchObject({ danger: true });
        expect(items.find((i) => i.id === "delete")?.separator).toBeUndefined();
    });

    test("a group: unmute and unfavourite when set, then leave", () => {
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

    test("a bot's DM can't be muted", () => {
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

describe("the list's spinner", () => {
    test("while its first messages are on their way, none being in the cache", () => {
        expect(listWaiting({ initialised: false, items: 0 })).toBe(true);
    });

    test("none once there are messages to show, though the first load hasn't ended", () => {
        expect(listWaiting({ initialised: false, items: 12 })).toBe(false);
    });

    test("none for a chat with nothing in it", () => {
        expect(listWaiting({ initialised: true, items: 0 })).toBe(false);
    });
});
