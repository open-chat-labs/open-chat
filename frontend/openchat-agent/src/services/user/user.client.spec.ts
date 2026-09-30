import { Principal } from "@icp-sdk/core/principal";
import { indexedUserId, type DirectChatIdentifier } from "@shared";
import { describe, expect, test } from "vitest";
import { UserClient } from "./user.client";

const THEM = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const USER_CANISTER_USER = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const MULTI_USER_CANISTER_USER = indexedUserId(
    Principal.fromText("dfdal-2uaaa-aaaaa-qaama-cai"),
    3,
);

describe("UserClient reading a direct chat's events", () => {
    const chatId: DirectChatIdentifier = { kind: "direct_chat", userId: THEM };

    // The `user_id` and `them` each of the three queries is sent with
    async function sent(userId: string): Promise<[string, string, string][]> {
        const queries: [string, string, string][] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = Object.create(UserClient.prototype) as any;
        client.userId = userId;
        client.query = (method: string, args: { user_id: Uint8Array; them: Uint8Array }) => {
            queries.push([
                method,
                Principal.fromUint8Array(args.user_id).toText(),
                Principal.fromUint8Array(args.them).toText(),
            ]);
            return Promise.resolve();
        };

        await client.chatEvents(chatId, 0, true, undefined, undefined);
        await client.chatEventsByIndex(chatId, [0], undefined, undefined);
        await client.chatEventsWindow(chatId, 0, undefined, undefined);
        return queries;
    }

    test("a MultiUser canister is told whose copy of the chat to read", async () => {
        expect(await sent(MULTI_USER_CANISTER_USER)).toEqual([
            ["events", MULTI_USER_CANISTER_USER, THEM],
            ["events_by_index", MULTI_USER_CANISTER_USER, THEM],
            ["events_window", MULTI_USER_CANISTER_USER, THEM],
        ]);
    });

    test("a User canister is sent the peer in `user_id`, where the previous wasm reads it", async () => {
        expect(await sent(USER_CANISTER_USER)).toEqual([
            ["events", THEM, THEM],
            ["events_by_index", THEM, THEM],
            ["events_window", THEM, THEM],
        ]);
    });
});
