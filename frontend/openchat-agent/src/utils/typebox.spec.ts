// Characterisation tests for typeboxValidate, the validator every msgpack request arg and
// every canister response passes through. The reference path is the original
// Value.Parse(["Default", "Convert", "Assert"]) pipeline; typeboxValidate must stay
// deep-equal to it for valid inputs and must throw wherever it throws.
import { describe, expect, test, vi } from "vitest";
import { Value } from "@sinclair/typebox/value";
import type { TSchema } from "@sinclair/typebox";
import { TypeboxValidationError } from "@shared";
import {
    CommunityEventsResponse,
    CommunitySendMessageResponse,
    LocalUserIndexChatEventsArgs,
    UserIndexUsersArgs,
    UserIndexUsersResponse,
    UserUpdatesResponse,
} from "../typebox";
import { deepRemoveNullishFields } from "./nullish";
import { typeboxValidate } from "./typebox";

function reference<T extends TSchema>(value: unknown, schema: T): unknown {
    return Value.Parse(["Default", "Convert", "Assert"], schema, deepRemoveNullishFields(value));
}

function message(i: number, extra: Record<string, unknown> = {}) {
    return {
        index: i,
        timestamp: String(1_700_000_000_000 + i), // string -> bigint via Convert
        expires_at: i % 3 === 0 ? null : undefined, // optional field, removed by nullish walk
        event: {
            Message: {
                message_index: i,
                message_id: 1_000_000 + i, // number -> bigint via Convert
                sender: new Uint8Array([1, 2, 3, i % 256]),
                content:
                    i % 2 === 0
                        ? { Text: { text: `m${i}` } }
                        : { Deleted: { deleted_by: [1, 2, 3], timestamp: BigInt(i) } },
                reactions: [["👍", [new Uint8Array([9]), "abc"]]],
                tips: [["aaaaa-aa", [[[1, 2], BigInt(5)]]]],
                thread_summary:
                    i % 5 === 0
                        ? {
                              participant_ids: ["u1"],
                              followed_by_me: false,
                              reply_count: 2,
                              latest_event_index: 7,
                              latest_event_timestamp: "123",
                          }
                        : undefined,
                edited: null,
                forwarded: false,
                og_previews: null,
                ...extra,
            },
        },
    };
}

function eventsResponse(n: number) {
    return {
        Success: {
            events: Array.from({ length: n }, (_, i) => message(i)),
            unauthorized: null,
            expired_event_ranges: [[1, 2]],
            latest_event_index: n,
            chat_last_updated: 1_700_000_000_000,
        },
    };
}

// Fixtures are factories: structuredClone in jsdom yields Uint8Arrays from another realm
// which fail Type.Uint8Array, so every case builds a fresh input instead of cloning.
const updatesResponse = () => ({
    Success: {
        timestamp: "1700000000000",
        username: null,
        display_name: { SetToSome: "Julian" },
        blocked_users: [[1, 2, 3], "u2"],
        achievements_last_seen: 5,
        total_chit_earned: 1,
        chit_balance: 2,
        streak: 3,
        streak_ends: 4,
        max_streak: 5,
        next_daily_claim: "6",
        premium_items: [1, 2],
        referrals: null,
        message_activity_summary: undefined,
    },
});

const usersResponse = () => ({
    Success: {
        users: [
            {
                user_id: "aaaaa-aa",
                stable: {
                    username: "bob",
                    display_name: null,
                    avatar_id: "12",
                    diamond_membership_status: "Active",
                },
                volatile: { total_chit_earned: 1, chit_balance: 1, streak: 0, max_streak: 0 },
            },
            { user_id: [1, 2, 3], stable: undefined, volatile: null },
        ],
        deleted: null,
        timestamp: 99,
    },
});

const chatEventsArgs = () => ({
    requests: [
        {
            context: { Group: ["aaaaa-aa", null] },
            args: { Page: { start_index: 1, ascending: false, max_messages: 50, max_events: 50 } },
            latest_known_update: null,
        },
        {
            context: { Channel: [[1, 2], "3", 7] },
            args: { ByIndex: { events: [1, 2, 3] } },
            latest_known_update: 5,
        },
    ],
});

// getUpdates-shaped: direct_chats.updated items carry OptionUpdate fields which have
// `default: "NoChange"` annotations, so Value.Default is not a no-op here.
const updatesWithChats = (bigints: boolean) => ({
    Success: {
        timestamp: bigints ? BigInt(1) : 1,
        direct_chats: {
            added: [],
            updated: [
                {
                    chat_id: "aaaaa-aa",
                    last_updated: bigints ? BigInt(2) : "2",
                    latest_event_index: 5,
                    notifications_muted: null,
                    updated_events: [[1, bigints ? BigInt(3) : 3]],
                    events_ttl: { SetToSome: bigints ? BigInt(9) : 9 },
                    video_call_in_progress: undefined,
                },
                { chat_id: [1, 2], last_updated: bigints ? BigInt(4) : 4, events_ttl: null },
            ],
            removed: ["u9"],
        },
        total_chit_earned: 1,
        chit_balance: 2,
        streak: 3,
        streak_ends: bigints ? BigInt(4) : 4,
        max_streak: 5,
        next_daily_claim: bigints ? BigInt(6) : 6,
    },
});

const cases: [string, TSchema, () => unknown][] = [
    ["CommunityEventsResponse Success", CommunityEventsResponse, () => eventsResponse(12)],
    ["CommunityEventsResponse Error", CommunityEventsResponse, () => ({ Error: [5, null] })],
    ["UserUpdatesResponse Success", UserUpdatesResponse, updatesResponse],
    ["UserUpdatesResponse literal", UserUpdatesResponse, () => "SuccessNoUpdates"],
    ["UserUpdatesResponse with chats (bigints)", UserUpdatesResponse, () => updatesWithChats(true)],
    [
        "UserUpdatesResponse with chats (numbers)",
        UserUpdatesResponse,
        () => updatesWithChats(false),
    ],
    ["UserIndexUsersResponse", UserIndexUsersResponse, usersResponse],
    [
        "CommunitySendMessageResponse",
        CommunitySendMessageResponse,
        () => ({ Success: { event_index: 1, message_index: 2, timestamp: "3", expires_at: null } }),
    ],
    ["LocalUserIndexChatEventsArgs", LocalUserIndexChatEventsArgs, chatEventsArgs],
    [
        "UserIndexUsersArgs",
        UserIndexUsersArgs,
        () => ({
            user_groups: [{ users: ["u1"], updated_since: 10 }],
            users_suspended_since: null,
        }),
    ],
];

describe("typeboxValidate matches the Value.Parse reference", () => {
    test.each(cases)("%s", (_name, schema, input) => {
        const expected = reference(input(), schema);
        const actual = typeboxValidate(input(), schema);
        expect(actual).toEqual(expected);
        // Convert must have produced real bigints, not left strings/numbers behind
        expect(JSON.stringify(actual, (_k, v) => (typeof v === "bigint" ? "BIGINT" : v))).toEqual(
            JSON.stringify(expected, (_k, v) => (typeof v === "bigint" ? "BIGINT" : v)),
        );
    });

    test("bigint fields are converted from string and number", () => {
        const out = typeboxValidate(eventsResponse(2), CommunityEventsResponse) as {
            Success: {
                events: { timestamp: bigint; event: { Message: { message_id: bigint } } }[];
            };
        };
        expect(typeof out.Success.events[0].timestamp).toBe("bigint");
        expect(typeof out.Success.events[0].event.Message.message_id).toBe("bigint");
    });

    test("nullish optional fields are removed, nullish variant keys are kept as null", () => {
        const out = typeboxValidate(eventsResponse(1), CommunityEventsResponse) as {
            Success: Record<string, unknown>;
        };
        expect("unauthorized" in out.Success).toBe(false);
        const err = typeboxValidate({ Error: [1, null] }, CommunityEventsResponse);
        expect(err).toEqual({ Error: [1, null] });
    });

    test("OptionUpdate defaults are applied exactly as Value.Default applies them", () => {
        // Value.Default only commits defaults inside a union variant when that variant
        // already checks (pre-Convert), so they apply when the payload's bigints are real
        // bigints and do not when they still need converting. Both are pinned here.
        type Out = {
            Success: {
                display_name?: unknown;
                direct_chats: { updated: Record<string, unknown>[] };
            };
        };
        const applied = typeboxValidate(updatesWithChats(true), UserUpdatesResponse) as Out;
        expect(applied.Success.display_name).toBe("NoChange");
        expect(applied.Success.direct_chats.updated[1].events_ttl).toBe("NoChange");
        expect(applied.Success.direct_chats.updated[0].events_ttl).toEqual({
            SetToSome: BigInt(9),
        });
        expect(applied).toEqual(reference(updatesWithChats(true), UserUpdatesResponse));

        const notApplied = typeboxValidate(updatesWithChats(false), UserUpdatesResponse) as Out;
        expect("display_name" in notApplied.Success).toBe(false);
        expect("events_ttl" in notApplied.Success.direct_chats.updated[1]).toBe(false);
        expect(notApplied).toEqual(reference(updatesWithChats(false), UserUpdatesResponse));
    });

    test("returns a converted copy, not the input instance", () => {
        const input = eventsResponse(1);
        const out = typeboxValidate(input, CommunityEventsResponse);
        expect(out).not.toBe(input);
        expect(out).toEqual(reference(eventsResponse(1), CommunityEventsResponse));
    });
});

describe("typeboxValidate rejects malformed payloads", () => {
    const bad: [string, TSchema, () => unknown][] = [
        [
            "wrong type for bigint",
            CommunityEventsResponse,
            () => ({
                Success: { ...eventsResponse(1).Success, chat_last_updated: "not-a-number" },
            }),
        ],
        [
            "missing required field",
            CommunityEventsResponse,
            () => ({ Success: { events: [], chat_last_updated: 1 } }),
        ],
        ["unknown union variant", CommunityEventsResponse, () => ({ Bogus: {} })],
        [
            "wrong nested content type",
            CommunityEventsResponse,
            () => ({
                Success: {
                    ...eventsResponse(0).Success,
                    events: [message(1, { content: { Text: { text: { nested: true } } } })],
                },
            }),
        ],
        ["null where object required", UserUpdatesResponse, () => ({ Success: null })],
        ["wrong literal", UserUpdatesResponse, () => "SuccessNoUpdatez"],
        ["array instead of object", UserIndexUsersResponse, () => [1, 2, 3]],
        ["undefined payload", UserIndexUsersResponse, () => undefined],
        [
            "request arg with wrong type",
            UserIndexUsersArgs,
            () => ({ user_groups: [{ users: ["u1"], updated_since: {} }] }),
        ],
        ["OCError tuple too long", CommunityEventsResponse, () => ({ Error: [1, "x", 3] })],
    ];

    test.each(bad)("%s", (_name, schema, input) => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            expect(() => reference(input(), schema)).toThrow();
            let thrown: unknown;
            try {
                typeboxValidate(input(), schema);
            } catch (e) {
                thrown = e;
            }
            expect(thrown).toBeInstanceOf(TypeboxValidationError);
            expect((thrown as Error).name).toBe("TypeboxValidationError");
            expect((thrown as Error).message.length).toBeGreaterThan(0);
        } finally {
            spy.mockRestore();
        }
    });

    test("error message matches the reference error message", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const input = { Success: { events: [], chat_last_updated: 1 } };
            let refMsg = "";
            try {
                reference(input, CommunityEventsResponse);
            } catch (e) {
                refMsg = (e as Error).message;
            }
            let msg = "";
            try {
                typeboxValidate(input, CommunityEventsResponse);
            } catch (e) {
                msg = (e as Error).message;
            }
            expect(refMsg.length).toBeGreaterThan(0);
            expect(msg).toBe(refMsg);
        } finally {
            spy.mockRestore();
        }
    });
});
