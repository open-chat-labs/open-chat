import { ROLE_ADMIN, ROLE_MEMBER, ROLE_MODERATOR, ROLE_NONE, ROLE_OWNER } from "@client";
import { describe, expect, test } from "vitest";
import {
    disappearingValue,
    dmTiles,
    durationLabel,
    groupTiles,
    historyValue,
    manageRows,
    memberMenuItems,
    menuItemRole,
    roleWord,
    showsManage,
} from "./details.adapter";

const t = (key: string, values?: Record<string, string | number>) =>
    values === undefined ? key : `${key}(${Object.values(values).join(",")})`;

describe("the tiles", () => {
    test("are a DM's Call / Search / Mute", () => {
        const tiles = dmTiles({ canCall: true, muted: false, isBot: false }, t);
        expect(tiles.map((x) => x.id)).toEqual(["call", "search", "mute"]);
        expect(tiles[2]).toMatchObject({ label: "native.details.tiles.mute", on: false });
    });

    test("leave out Call where calls can't start, and Mute for a bot", () => {
        expect(dmTiles({ canCall: false, muted: false, isBot: true }, t).map((x) => x.id)).toEqual([
            "search",
        ]);
    });

    test("show a muted chat's Mute as on, offering Unmute", () => {
        expect(dmTiles({ canCall: false, muted: true, isBot: false }, t)[1]).toMatchObject({
            id: "mute",
            label: "native.details.tiles.unmute",
            on: true,
        });
    });

    test("are a group's Mute / Search / Invite, Invite only for someone who can invite", () => {
        expect(groupTiles({ canInvite: true, muted: false }, t).map((x) => x.id)).toEqual([
            "mute",
            "search",
            "invite",
        ]);
        expect(groupTiles({ canInvite: false, muted: false }, t).map((x) => x.id)).toEqual([
            "mute",
            "search",
        ]);
    });
});

describe("Manage", () => {
    test("is for owners and admins only", () => {
        expect(showsManage(ROLE_OWNER, false)).toBe(true);
        expect(showsManage(ROLE_ADMIN, false)).toBe(true);
        expect(showsManage(ROLE_MODERATOR, false)).toBe(false);
        expect(showsManage(ROLE_MEMBER, false)).toBe(false);
        expect(showsManage(ROLE_NONE, false)).toBe(false);
    });

    test("isn't offered in a frozen chat", () => {
        expect(showsManage(ROLE_OWNER, true)).toBe(false);
    });

    test("lists the settings pages in the design's order", () => {
        expect(manageRows(t).map((r) => r.page)).toEqual([
            "gates",
            "rules",
            "permissions",
            "bots",
            "stats",
        ]);
    });
});

describe("values", () => {
    test("say a duration in the app's words", () => {
        expect(durationLabel("8 hours", t)).toBe("native.details.duration.hour(8)");
        expect(durationLabel("1 week", t)).toBe("native.details.duration.week(1)");
    });

    test("say a group's disappearing messages are off, or how long they last", () => {
        expect(disappearingValue(undefined, t)).toBe("native.you.off");
        expect(disappearingValue(BigInt(86_400_000), t)).toBe("native.details.duration.day(1)");
    });

    test("say whether new members see the history", () => {
        expect(historyValue(true, t)).toBe("native.details.historyVisible");
        expect(historyValue(false, t)).toBe("native.details.historyHidden");
    });
});

describe("a member's ⋯", () => {
    test("lists the roles, then Remove and Block after a divider", () => {
        const items = memberMenuItems(
            { kind: "actions", roles: [ROLE_OWNER, ROLE_MEMBER], remove: true, block: true },
            t,
        );
        expect(items.map((i) => i.id)).toEqual([`role:${ROLE_OWNER}`, `role:${ROLE_MEMBER}`, "remove", "block"]);
        expect(items.map((i) => i.label)).toEqual([
            "native.details.members.make.owner",
            "native.details.members.make.member",
            "native.details.members.remove",
            "native.details.members.block",
        ]);
        expect(items[2]).toMatchObject({ danger: true, separator: true });
        expect(items[3].separator).toBeUndefined();
    });

    test("has no divider with only Remove and Block", () => {
        const items = memberMenuItems({ kind: "actions", roles: [], remove: true, block: false }, t);
        expect(items).toEqual([
            { id: "remove", label: "native.details.members.remove", icon: "user-minus", danger: true },
        ]);
    });

    test("gives the role its item names", () => {
        expect(menuItemRole(`role:${ROLE_ADMIN}`)).toBe(ROLE_ADMIN);
        expect(menuItemRole("remove")).toBeUndefined();
        expect(menuItemRole("role:9")).toBeUndefined();
    });

    test("names a role by its word", () => {
        expect(roleWord(ROLE_MODERATOR)).toBe("moderator");
        expect(roleWord(ROLE_NONE)).toBe("member");
    });
});
