import { ROLE_ADMIN, ROLE_MEMBER, ROLE_MODERATOR, ROLE_NONE, ROLE_OWNER } from "@client";
import { describe, expect, test } from "vitest";
import {
    inviteAccess,
    invitePeopleLists,
    inviteRole,
    inviteWay,
    type InviteAccessState,
    type InviteWayContext,
} from "./invitePeople";

const state = (over: Partial<InviteAccessState>): InviteAccessState => ({
    member: true,
    active: true,
    canInviteUsers: false,
    canAddMembers: false,
    canInviteByLink: false,
    public: false,
    ...over,
});

describe("inviteAccess", () => {
    test("someone who may invite gets People and the Invite link, and manages the link", () => {
        expect(inviteAccess(state({ canInviteUsers: true, canInviteByLink: true }))).toEqual({
            kind: "allowed",
            tabs: ["people", "link"],
            invite: true,
            add: false,
            manageLink: true,
        });
    });

    test("a public group's plain member gets its link only, which they can't switch or reset", () => {
        expect(inviteAccess(state({ public: true }))).toEqual({
            kind: "allowed",
            tabs: ["link"],
            invite: false,
            add: false,
            manageLink: false,
        });
    });

    test("a private community's channel: adding its members is People, with no link", () => {
        expect(inviteAccess(state({ canAddMembers: true }))).toEqual({
            kind: "allowed",
            tabs: ["people"],
            invite: false,
            add: true,
            manageLink: false,
        });
    });

    test("a private group's member who may not invite is told so", () => {
        expect(inviteAccess(state({}))).toEqual({ kind: "not_allowed" });
    });

    test("no one previewing, nor in a frozen chat, invites", () => {
        const can = { canInviteUsers: true, canInviteByLink: true, public: true };
        expect(inviteAccess(state({ ...can, member: false }))).toEqual({ kind: "not_allowed" });
        expect(inviteAccess(state({ ...can, active: false }))).toEqual({ kind: "not_allowed" });
    });
});

describe("inviteRole", () => {
    test("names the lowest role the permission lets invite, owners where it's no one", () => {
        expect(inviteRole(ROLE_MEMBER)).toBe("member");
        expect(inviteRole(ROLE_MODERATOR)).toBe("moderator");
        expect(inviteRole(ROLE_ADMIN)).toBe("admin");
        expect(inviteRole(ROLE_OWNER)).toBe("owner");
        expect(inviteRole(ROLE_NONE)).toBe("owner");
    });
});

const ctx = (over: Partial<InviteWayContext>): InviteWayContext => ({
    me: "me",
    members: new Set(["m"]),
    invited: new Set(["i"]),
    communityMembers: undefined,
    invite: true,
    add: false,
    inviteOutsiders: false,
    ...over,
});

describe("inviteWay", () => {
    test("members (you too) and the invited are marked; anyone else in a group is invited", () => {
        expect(inviteWay("me", ctx({}))).toBe("member");
        expect(inviteWay("m", ctx({}))).toBe("member");
        expect(inviteWay("i", ctx({}))).toBe("invited");
        expect(inviteWay("x", ctx({}))).toBe("invite");
        expect(inviteWay("x", ctx({ invite: false }))).toBe("none");
    });

    test("a channel adds its community's members where it may, and invites outsiders only where it may invite to the community", () => {
        const channel = { communityMembers: new Set(["c"]) };
        expect(inviteWay("c", ctx({ ...channel, add: true }))).toBe("add");
        expect(inviteWay("c", ctx({ ...channel, add: false }))).toBe("invite");
        expect(inviteWay("c", ctx({ ...channel, add: false, invite: false }))).toBe("none");
        expect(inviteWay("o", ctx({ ...channel }))).toBe("none");
        expect(inviteWay("o", ctx({ ...channel, inviteOutsiders: true }))).toBe("invite");
        expect(
            inviteWay("o", ctx({ ...channel, invite: false, add: true, inviteOutsiders: true })),
        ).toBe("none");
    });
});

describe("invitePeopleLists", () => {
    const u = (userId: string) => ({ userId });

    test("with nothing searched: Pending, then Suggested with only those who can be picked", () => {
        const lists = invitePeopleLists(
            {
                searching: false,
                invited: [u("i")],
                suggested: [u("m"), u("x"), u("i"), u("y")],
                matches: [],
            },
            ctx({}),
        );
        expect(lists.pending).toEqual([u("i")]);
        expect(lists.suggested).toEqual([
            { userId: "x", way: "invite" },
            { userId: "y", way: "invite" },
        ]);
        expect(lists.results).toEqual([]);
    });

    test("with a search: every match once, members and the invited marked, those who can't join left out", () => {
        const lists = invitePeopleLists(
            {
                searching: true,
                invited: [u("i")],
                suggested: [u("x")],
                matches: [u("x"), u("i"), u("m"), u("x"), u("o")],
            },
            ctx({ communityMembers: new Set(["x", "i", "m"]) }),
        );
        expect(lists.pending).toEqual([]);
        expect(lists.suggested).toEqual([]);
        expect(lists.results).toEqual([
            { userId: "x", way: "invite" },
            { userId: "i", way: "invited" },
            { userId: "m", way: "member" },
        ]);
    });
});
