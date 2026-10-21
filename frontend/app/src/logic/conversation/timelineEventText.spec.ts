import {
    ROLE_ADMIN,
    type AggregateCommonEvents,
    type ChatEvent,
    type MemberRole,
    type UserLookup,
    type UserSummary,
} from "@client";
import { describe, expect, test } from "vitest";
import {
    aggregateEventText,
    isTextEvent,
    timelineEventText,
    type EventTextContext,
    type TextEvent,
} from "./timelineEventText";

function user(userId: string, username: string): UserSummary {
    return { kind: "user", userId, username } as UserSummary;
}

const users: UserLookup = new Map([
    ["me", user("me", "me")],
    ["alice", user("alice", "Alice")],
    ["bob", user("bob", "Bob")],
]);

const ctx: EventTextContext = {
    formatter: (key, options) =>
        options?.values ? `${key}${JSON.stringify(options.values)}` : key,
    me: "me",
    users,
    displayName: (userId, kind) =>
        kind === "me" ? "**you**" : `**${users.get(userId)?.username ?? "unknownUser"}**`,
    level: "channel",
    canInvite: false,
    botName: (botId) => (botId === "b1" ? "Echo" : undefined),
};

const text = (event: Partial<TextEvent>, c: EventTextContext = ctx) =>
    timelineEventText(event as TextEvent, c);

/** Invariant: a timeline event reads the same in every tree, names in bold (ChatEvent's old wording). */
describe("a timeline event's line", () => {
    test("names who changed the members, and whom, in bold, you last", () => {
        expect(
            text({ kind: "members_added", userIds: ["me", "bob", "alice"], addedBy: "alice" }),
        ).toBe(
            'addedBy{"changed":"**Alice**, **Bob** and **you**","changedBy":"**Alice**","level":"level.channel"}',
        );
    });

    test("words a group change with the property and the level", () => {
        expect(text({ kind: "name_changed", changedBy: "me" } as Partial<TextEvent>)).toBe(
            'groupChangedBy{"changed":"groupName{\\"level\\":\\"level.channel\\"}","changedBy":"**you**","level":"level.channel"}',
        );
    });

    test("shows rules being turned on, and nothing while they stay off", () => {
        expect(
            text({ kind: "rules_changed", enabled: true, enabledPrev: false, changedBy: "bob" }),
        ).toBe('groupRulesEnabled{"changed":"groupRules","changedBy":"**Bob**"}');
        expect(
            text({ kind: "rules_changed", enabled: false, enabledPrev: false, changedBy: "bob" }),
        ).toBeUndefined();
    });

    test("shows an invite link change only to those who can invite", () => {
        const change = {
            kind: "group_invite_code_changed",
            change: "reset",
            changedBy: "bob",
        } as const;
        expect(text(change)).toBeUndefined();
        expect(text(change, { ...ctx, canInvite: true })).toBe(
            'groupInviteChangedBy{"changedBy":"**Bob**","changed":"invite.reset"}',
        );
    });

    test("is for the events shown as a line, not messages or the aggregate", () => {
        expect(isTextEvent({ kind: "gate_updated" } as ChatEvent)).toBe(true);
        expect(isTextEvent({ kind: "message" } as ChatEvent)).toBe(false);
        expect(isTextEvent({ kind: "aggregate_common_events" } as ChatEvent)).toBe(false);
    });
});

describe("a run of joins, deletions and role changes", () => {
    const aggregate = (fields: Partial<AggregateCommonEvents>): AggregateCommonEvents => ({
        kind: "aggregate_common_events",
        usersJoined: new Set(),
        usersLeft: new Set(),
        rolesChanged: new Map(),
        messagesDeleted: [],
        ...fields,
    });

    test("has a line each for who joined and how many messages went", () => {
        expect(
            aggregateEventText(
                aggregate({ usersJoined: new Set(["bob"]), messagesDeleted: [4, 5] }),
                ctx,
            ),
        ).toEqual({
            joined: 'userJoined{"username":"**Bob**","level":"level.channel"}',
            deleted: 'nMessagesDeleted{"number":2}',
            rolesChanged: [],
        });
    });

    test("tells the reader their own role changed", () => {
        const roles = new Map([
            ["alice", new Map<MemberRole, Set<string>>([[ROLE_ADMIN, new Set(["me"])]])],
        ]);
        expect(aggregateEventText(aggregate({ rolesChanged: roles }), ctx).rolesChanged).toEqual([
            'yourRoleChanged{"changed":"**you**","changedBy":"**Alice**","newRole":"admin"}',
        ]);
    });
});
