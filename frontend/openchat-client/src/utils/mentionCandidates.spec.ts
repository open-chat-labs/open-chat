import type { UserGroupSummary, UserOrUserGroup, UserSummary } from "@shared";
import {
    mentionCandidateKey,
    mentionCandidates,
    mentionName,
    type MentionCandidateOptions,
} from "./mentionCandidates";

function user(userId: string, username: string, displayName?: string): UserSummary {
    return {
        kind: "user",
        userId,
        username,
        displayName,
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    };
}

function group(id: number, name: string): UserGroupSummary {
    return { kind: "user_group", id, name, memberCount: 1 };
}

const everyone: UserOrUserGroup = { kind: "everyone" };
const me = user("me", "myself");
const alice = user("a", "alice", "Ally");
const al = user("b", "al");
const bob = user("c", "bob");
const bot = { ...user("d", "alfred"), kind: "bot" as const };
const admins = group(1, "admins");
const all = group(2, "all");

const options: MentionCandidateOptions = {
    me: "me",
    mentionSelf: false,
    supportsUserGroups: true,
    usersOnly: false,
    keepUserOrder: false,
};

const names = (candidates: UserOrUserGroup[]) => candidates.map(mentionName);

describe("who a mention picker offers", () => {
    const pool = [bob, alice, me, admins, bot, everyone, al, all];

    /** 5c invariant 6: never the reader, and @everyone first. */
    test("puts @everyone first and never offers the user picking", () => {
        const offered = mentionCandidates(pool, undefined, options);
        expect(offered[0]).toBe(everyone);
        expect(offered).not.toContain(me);
    });

    test("then groups, then users and bots, each by the shortest name first", () => {
        expect(names(mentionCandidates(pool, undefined, options))).toEqual([
            "everyone",
            "all",
            "admins",
            "al",
            "bob",
            "alice",
            "alfred",
        ]);
    });

    test("matches what's typed at the start of a username, display name or group name", () => {
        expect(names(mentionCandidates(pool, "Al", options))).toEqual([
            "all",
            "al",
            "alice",
            "alfred",
        ]);
        expect(names(mentionCandidates(pool, "ally", options))).toEqual(["alice"]);
        expect(names(mentionCandidates(pool, "ev", options))).toEqual(["everyone"]);
        expect(mentionCandidates(pool, "zed", options)).toEqual([]);
    });

    test("can offer the user picking", () => {
        expect(mentionCandidates(pool, "my", { ...options, mentionSelf: true })).toEqual([me]);
    });

    test("offers only users when asked to, and groups for what's typed only where they're supported", () => {
        expect(names(mentionCandidates(pool, "a", { ...options, usersOnly: true }))).toEqual([
            "al",
            "alice",
            "alfred",
        ]);
        expect(
            names(mentionCandidates(pool, "a", { ...options, supportsUserGroups: false })),
        ).toEqual(["al", "alice", "alfred"]);
    });

    test("keeps users in the order given when asked to", () => {
        expect(
            names(
                mentionCandidates([bob, alice, al], undefined, { ...options, keepUserOrder: true }),
            ),
        ).toEqual(["bob", "alice", "al"]);
    });

    test("keys each by its user, group or @everyone", () => {
        expect([alice, admins, everyone].map(mentionCandidateKey)).toEqual(["a", "1", "everyone"]);
    });
});
