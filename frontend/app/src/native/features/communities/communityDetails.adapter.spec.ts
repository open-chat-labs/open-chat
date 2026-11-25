import { ROLE_ADMIN, ROLE_MEMBER, ROLE_NONE, ROLE_OWNER, type CommunityPermissions } from "@client";
import { defaultCommunityPermissions } from "@src/stores/community";
import { describe, expect, test } from "vitest";
import {
    allChannelsMuted,
    communityTiles,
    dangerAction,
    detailsSections,
    infoRows,
    manageMeta,
    muteHelp,
    rulesCount,
    type ManageState,
} from "./communityDetails.adapter";

const t = (key: string, values?: Record<string, string | number>) =>
    values === undefined ? key : `${key} ${JSON.stringify(values)}`;

const channel = (muted: boolean) => ({ membership: { notificationsMuted: muted } }) as never;

describe("the tiles", () => {
    test("Invite for someone who may invite, Search (disabled), then Mute or Unmute", () => {
        expect(communityTiles({ canInvite: true, muted: false }, t).map((x) => x.id)).toEqual([
            "invite",
            "search",
            "mute",
        ]);
        const tiles = communityTiles({ canInvite: false, muted: true }, t);
        expect(tiles.map((x) => x.id)).toEqual(["search", "mute"]);
        expect(tiles[0].disabled).toBe(true);
        expect(tiles[1]).toMatchObject({
            icon: "bell",
            label: "native.details.tiles.unmute",
            on: true,
        });
    });
});

describe("the mute", () => {
    test("muted when every channel of the user's is", () => {
        expect(allChannelsMuted([channel(true), channel(true)])).toBe(true);
        expect(allChannelsMuted([channel(true), channel(false)])).toBe(false);
        expect(allChannelsMuted([])).toBe(false);
    });

    test("its line says what it does now", () => {
        expect(muteHelp(true, t)).toBe("native.communityDetails.muteHelpOn");
        expect(muteHelp(false, t)).toBe("native.communityDetails.muteHelpOff");
    });
});

describe("who sees what", () => {
    test("Manage for owners and admins who may edit; the Info rows for the rest", () => {
        expect(detailsSections(ROLE_OWNER, true, false)).toEqual({ manage: true, info: false });
        expect(detailsSections(ROLE_ADMIN, true, false)).toEqual({ manage: true, info: false });
        expect(detailsSections(ROLE_MEMBER, false, false)).toEqual({ manage: false, info: true });
        // an admin whose community's permissions don't let them edit it, or a frozen community
        expect(detailsSections(ROLE_ADMIN, false, false)).toEqual({ manage: false, info: true });
        expect(detailsSections(ROLE_OWNER, true, true)).toEqual({ manage: false, info: true });
        expect(detailsSections(ROLE_NONE, false, false)).toEqual({ manage: false, info: false });
    });

    test("the owner deletes, anyone else leaves", () => {
        expect(dangerAction(true, true)).toBe("delete");
        expect(dangerAction(false, true)).toBe("leave");
        expect(dangerAction(false, false)).toBeUndefined();
    });
});

describe("the Info rows", () => {
    test("rules are counted by their lines, none while they're off", () => {
        expect(rulesCount({ enabled: true, text: "- one\n\n- two\n  \n- three" })).toBe(3);
        expect(rulesCount({ enabled: false, text: "- one" })).toBe(0);
        expect(rulesCount(undefined)).toBe(0);
    });

    test("Channels, Rules and Access gates with what they hold", () => {
        expect(infoRows({ channels: 3, rules: 0, gates: 2 }, t).map((r) => r.value)).toEqual([
            "3",
            "native.communityDetails.none",
            'native.communityDetails.gatesCount {"count":2}',
        ]);
    });
});

describe("Manage's values", () => {
    const state: ManageState = {
        channels: 4,
        userGroups: 0,
        link: undefined,
        gates: 1,
        rulesEnabled: false,
        permissions: defaultCommunityPermissions(),
        bots: 2,
    };

    test("each row's, quiet where nothing's set", () => {
        expect(manageMeta("channels", state, t)).toEqual({
            value: 'native.communityDetails.channelsCount {"count":4}',
            set: true,
        });
        expect(manageMeta("user_groups", state, t)).toEqual({
            value: "native.communityDetails.none",
            set: false,
        });
        expect(manageMeta("gates", state, t)?.set).toBe(true);
        expect(manageMeta("rules", state, t)).toEqual({ value: "native.you.off", set: false });
        expect(manageMeta("permissions", state, t)).toEqual({
            value: "native.groupSettings.permissions.default",
            set: false,
        });
        expect(manageMeta("bots", state, t)?.value).toBe('native.communityDetails.botsCount {"count":2}');
        expect(manageMeta("stats", state, t)).toBeUndefined();
    });

    test("the invite link once it's known", () => {
        expect(manageMeta("invite", state, t)).toBeUndefined();
        expect(manageMeta("invite", { ...state, link: "on" }, t)).toEqual({
            value: "native.communityDetails.linkOn",
            set: true,
        });
        expect(manageMeta("invite", { ...state, link: "off" }, t)?.set).toBe(false);
    });

    test("permissions changed from the defaults are counted", () => {
        const permissions: CommunityPermissions = {
            ...defaultCommunityPermissions(),
            inviteUsers: ROLE_MEMBER,
        };
        expect(manageMeta("permissions", { ...state, permissions }, t)).toEqual({
            value: 'native.groupSettings.permissions.changedCount {"count":1}',
            set: true,
        });
    });
});
