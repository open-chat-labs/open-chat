import { describe, expect, test } from "vitest";
import {
    callEventProps,
    disappearingPick,
    disappearingSubmenu,
    headerMenuItems,
    isDisappearingItem,
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

// native plan 04: "Disappearing messages (submenu: Off + the same 8 durations as in details, 10)"
describe("the menu's disappearing messages", () => {
    const words = { off: "Off", duration: (id: string) => `<${id}>` };

    test("after the favourite, for someone who may set them, with Off and the 8 lengths", () => {
        const items = headerMenuItems(
            { ...dm, disappearing: { on: true, after: "1 day" } },
            label,
            words,
        );
        expect(items.map((i) => i.id)).toEqual([
            "search",
            "details",
            "mute",
            "favourite",
            "disappearing",
            "block",
            "delete",
        ]);
        const sub = items[4].submenu;
        expect(items[4]).toMatchObject({ label: "[disappearing]", icon: "clock" });
        expect(items[4].separator).toBeUndefined();
        expect(sub?.title).toBe("[disappearing]");
        expect(sub?.items.map((i) => i.label)).toEqual([
            "Off",
            "<5 minutes>",
            "<15 minutes>",
            "<1 hour>",
            "<8 hours>",
            "<12 hours>",
            "<1 day>",
            "<1 week>",
            "<30 days>",
        ]);
        expect(sub?.items.filter((i) => i.selected).map((i) => i.id)).toEqual([
            "disappearing:1 day",
        ]);
    });

    test("none for someone who can't set them", () => {
        expect(headerMenuItems(dm, label, words).map((i) => i.id)).not.toContain("disappearing");
    });

    test("off ticks Off; a chat's own length shows, ticked", () => {
        const off = disappearingSubmenu({ on: false, after: "8 hours" }, "t", words);
        expect(off.items.filter((i) => i.selected).map((i) => i.id)).toEqual(["disappearing:off"]);
        expect(off.items).toHaveLength(9);
        const other = disappearingSubmenu({ on: true, after: "2 days" }, "t", words);
        expect(other.items).toHaveLength(10);
        expect(other.items.find((i) => i.selected)?.id).toBe("disappearing:2 days");
    });

    // the conversation's onMenu sends only these to the disappearing setting; any other id,
    // one added later included, isn't swallowed by it
    test("tells the submenu's rows from the menu's other items", () => {
        const items = disappearingSubmenu({ on: true, after: "1 day" }, "t", words).items;
        expect(items.every((i) => isDisappearingItem(i.id))).toBe(true);
        for (const id of ["disappearing", "mute", "details", "delete", "block", "leave"]) {
            expect(isDisappearingItem(id)).toBe(false);
        }
    });

    test("a pick sets a length or Off; the setting they already have sets nothing", () => {
        const on = { on: true, after: "1 day" };
        expect(disappearingPick("disappearing:8 hours", on)).toEqual({ on: true, after: "8 hours" });
        // Off keeps the length, as the details' switch does
        expect(disappearingPick("disappearing:off", on)).toEqual({ on: false, after: "1 day" });
        expect(disappearingPick("disappearing:1 day", on)).toBeUndefined();
        expect(disappearingPick("disappearing:off", { on: false, after: "1 day" })).toBeUndefined();
        expect(disappearingPick("disappearing:1 day", { on: false, after: "1 day" })).toEqual(on);
        expect(disappearingPick("mute", on)).toBeUndefined();
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
