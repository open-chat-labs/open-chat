import { Principal } from "@icp-sdk/core/principal";
import {
    indexedUserId,
    type CryptocurrencyContent,
    type DirectChatIdentifier,
    type MessageContent,
} from "@shared";
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

    test("a User canister is told whose copy of the chat to read too", async () => {
        expect(await sent(USER_CANISTER_USER)).toEqual([
            ["events", USER_CANISTER_USER, THEM],
            ["events_by_index", USER_CANISTER_USER, THEM],
            ["events_window", USER_CANISTER_USER, THEM],
        ]);
    });
});

describe("UserClient sending crypto in a direct chat", () => {
    const ME = Principal.fromText("2vxsx-fae");
    const EXTERNAL_ACCOUNT = "rno2w-sqaaa-aaaaa-aaacq-cai";

    function crypto(fromAccount?: string): CryptocurrencyContent {
        return {
            kind: "crypto_content",
            caption: undefined,
            transfer: {
                kind: "pending",
                ledger: "ryjl3-tyaaa-aaaaa-aaaba-cai",
                token: "ICP",
                recipient: THEM,
                amountE8s: 100n,
                createdAtNanos: 0n,
                fromAccount,
            },
        };
    }

    // The account the transfer is sent as coming from
    function fromAccount(userId: string, content: MessageContent): string | undefined {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = Object.create(UserClient.prototype) as any;
        client.userId = userId;
        client.identity = { getPrincipal: () => ME };
        const sent = client.transferFromWallet(content);
        return sent.kind === "crypto_content" && sent.transfer.kind === "pending"
            ? sent.transfer.fromAccount
            : undefined;
    }

    test("a MultiUser canister pulls it from the user's wallet", () => {
        expect(fromAccount(MULTI_USER_CANISTER_USER, crypto())).toEqual(ME.toText());
    });

    test("a MultiUser canister pulls it from another account the user chose", () => {
        expect(fromAccount(MULTI_USER_CANISTER_USER, crypto(EXTERNAL_ACCOUNT))).toEqual(
            EXTERNAL_ACCOUNT,
        );
    });

    test("a User canister sends it from its own account", () => {
        expect(fromAccount(USER_CANISTER_USER, crypto())).toBeUndefined();
    });

    test("any other message is left as it is", () => {
        const content: MessageContent = { kind: "text_content", text: "hello" };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = Object.create(UserClient.prototype) as any;
        client.userId = MULTI_USER_CANISTER_USER;
        client.identity = { getPrincipal: () => ME };

        expect(client.transferFromWallet(content)).toBe(content);
    });
});

describe("UserClient approving a spender", () => {
    const LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
    const SPENDER = Principal.fromText("rno2w-sqaaa-aaaaa-aaacq-cai");

    // The spender the User canister is asked to approve
    async function approved(subaccount?: Uint8Array): Promise<unknown> {
        let sent: { spender: unknown } | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = Object.create(UserClient.prototype) as any;
        client.update = (method: string, args: { spender: unknown }) => {
            expect(method).toEqual("approve_transfer");
            sent = args;
            return Promise.resolve({ kind: "success" });
        };

        await client.approveTransfer({ owner: SPENDER, subaccount }, LEDGER, 100n, 1_000n, "1234");
        return sent?.spender;
    }

    test("a spender's subaccount is approved, as a group or community pulls a gate's payment", async () => {
        const subaccount = new Uint8Array(32).fill(7);

        expect(await approved(subaccount)).toEqual({
            owner: SPENDER.toUint8Array(),
            subaccount: [...subaccount],
        });
    });

    test("a spender's default account is approved, as the ProposalsBot pulls a proposal's fee", async () => {
        expect(await approved()).toEqual({ owner: SPENDER.toUint8Array(), subaccount: undefined });
    });
});
