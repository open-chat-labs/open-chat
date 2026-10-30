import { Principal } from "@icp-sdk/core/principal";
import type {
    DailyResultContent,
    MessageContent,
    PendingCryptocurrencyTransfer,
    PriceChartContent,
} from "@shared";
import { encodeIcrcAccount } from "@shared";
import { describe, expect, test } from "vitest";
import type {
    MessageContent as TMessageContent,
    MiniAppStatus as TMiniAppStatus,
} from "../../typebox";
import {
    addressToIcrcAccount,
    apiExternalBotPermissions,
    apiMaybeAccessGate,
    apiMessageContent,
    groupDetailsUpdatesResponse,
    apiPendingCryptoTransaction,
    externalBotPermissions,
    formatIcrcAccount,
    messageContent,
    pendingCryptoTransfer,
    sendMessageSuccess,
    transferFrom,
} from "./chatMappersV2";

const ledger = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const recipient = "dfdal-2uaaa-aaaaa-qaama-cai";
const walletOwner = Principal.selfAuthenticating(new Uint8Array(32).fill(7)).toText();
const subaccount = new Uint8Array(32);
subaccount[31] = 5;
const walletWithSubaccount = encodeIcrcAccount({
    owner: Principal.fromText(walletOwner),
    subaccount,
});

const transfer: PendingCryptocurrencyTransfer = {
    kind: "pending",
    ledger,
    token: "ICP",
    recipient,
    amountE8s: 100_000_000n,
    feeE8s: 10_000n,
    memo: 123n,
    createdAtNanos: 1_700_000_000_000_000_000n,
};

describe("icrc account address mapping", () => {
    test("round trips an account with no subaccount", () => {
        expect(formatIcrcAccount(addressToIcrcAccount(walletOwner))).toEqual(walletOwner);
    });

    test("round trips an account with a subaccount", () => {
        expect(formatIcrcAccount(addressToIcrcAccount(walletWithSubaccount))).toEqual(
            walletWithSubaccount,
        );
    });
});

describe("pending crypto transaction mapping", () => {
    test("emits ICRC1 when there is no fromAccount", () => {
        const api = apiPendingCryptoTransaction(transfer);
        expect(api).toHaveProperty("Pending.ICRC1");
        expect(api).not.toHaveProperty("Pending.ICRC2");
    });

    test("emits ICRC2 when a fromAccount is set", () => {
        const api = apiPendingCryptoTransaction({ ...transfer, fromAccount: walletWithSubaccount });
        expect(api).not.toHaveProperty("Pending.ICRC1");
        expect(api).toHaveProperty(
            "Pending.ICRC2.from",
            addressToIcrcAccount(walletWithSubaccount),
        );
    });

    test("an ICRC2 transfer round trips unchanged", () => {
        const domain = { ...transfer, fromAccount: walletWithSubaccount };
        const api = apiPendingCryptoTransaction(domain);
        if (!("Pending" in api)) throw new Error("Expected a pending transaction");
        expect(pendingCryptoTransfer(api.Pending, recipient)).toEqual(domain);
    });

    test("an ICRC1 transfer round trips unchanged", () => {
        const api = apiPendingCryptoTransaction(transfer);
        if (!("Pending" in api)) throw new Error("Expected a pending transaction");
        expect(pendingCryptoTransfer(api.Pending, recipient)).toEqual(transfer);
    });
});

describe("daily result custom content mapping", () => {
    const card: DailyResultContent = {
        kind: "daily_result",
        gameId: "crossword",
        number: 42,
        userId: "user-1",
        solveTimeMs: 123_456,
        hintsUsed: 2,
        streak: 7,
        layout: "0105050a0b",
        tier: 1,
    };

    function roundTrip(content: DailyResultContent) {
        return messageContent(apiMessageContent(content) as TMessageContent, "user-1");
    }

    test("round trips with and without a caption", () => {
        const captioned = { ...card, caption: "got there in the end" };
        expect(roundTrip(card)).toEqual(card);
        expect(roundTrip(captioned)).toEqual(captioned);
    });
});

describe("price chart content mapping", () => {
    const chart: PriceChartContent = {
        kind: "price_chart_content",
        title: "CHAT and ADA · 30 days",
        start: 1_790_000_000_000,
        end: 1_792_592_000_000,
        series: [
            {
                token: { kind: "token", ledger },
                symbol: "CHAT",
                name: "OpenChat",
                points: [
                    { timestamp: 1_790_000_000_000, usd: 0.0312 },
                    { timestamp: 1_791_000_000_000, usd: 0.0287 },
                ],
            },
            {
                token: { kind: "coin", id: "cardano" },
                symbol: "ADA",
                name: "Cardano",
                points: [{ timestamp: 1_790_500_000_000, usd: 0.21 }],
            },
        ],
        sources: [
            { name: "ICPSwap", url: "https://www.icpswap.com" },
            { name: "CoinGecko", url: "https://www.coingecko.com" },
        ],
    };

    test("reads a chart a bot sent", () => {
        const api = apiMessageContent(chart);
        expect(api).toMatchObject({
            PriceChart: {
                start: 1_790_000_000_000n,
                series: [{ token: { Ledger: expect.anything() } }, {}],
            },
        });
        expect(messageContent(api as TMessageContent, "bot-1")).toEqual(chart);
    });
});

describe("prize content mapping", () => {
    // One of the two ledgers whose symbol is TENDY
    const tendy = "kylwo-viaaa-aaaaq-aae7a-cai";

    test("keeps the prize's ledger as well as its symbol", () => {
        const content = messageContent(
            {
                Prize: {
                    prizes_remaining: 2,
                    prizes_pending: 1,
                    winner_count: 3,
                    user_is_winner: false,
                    token_symbol: "TENDY",
                    ledger: Principal.fromText(tendy).toUint8Array(),
                    end_date: 1_000n,
                    caption: "a prize",
                    diamond_only: false,
                    lifetime_diamond_only: false,
                    unique_person_only: false,
                    streak_only: 0,
                    requires_captcha: false,
                    min_chit_earned: 0,
                },
            },
            "user-1",
        );

        expect(content).toMatchObject({ kind: "prize_content", token: "TENDY", ledger: tendy });
    });
});

describe("a transfer pulled by the canister its message is sent to", () => {
    const crypto: MessageContent = { kind: "crypto_content", caption: undefined, transfer };

    test("is pulled from the account given, as an ICRC2 transfer", () => {
        const content = transferFrom(crypto, walletOwner);

        expect(content).toEqual({ ...crypto, transfer: { ...transfer, fromAccount: walletOwner } });
        expect(
            apiPendingCryptoTransaction({ ...transfer, fromAccount: walletOwner }),
        ).toHaveProperty("Pending.ICRC2");
    });

    test("keeps the account it already names", () => {
        const fromWallet: MessageContent = {
            ...crypto,
            transfer: { ...transfer, fromAccount: walletWithSubaccount },
        };

        expect(transferFrom(fromWallet, walletOwner)).toBe(fromWallet);
    });

    test("a message holding no such transfer is left as it is", () => {
        const text: MessageContent = { kind: "text_content", text: "hello" };

        expect(transferFrom(text, walletOwner)).toBe(text);
    });

    test("comes back from a group or community as the transfer it made", () => {
        const sent = {
            event_index: 3,
            message_index: 2,
            timestamp: 10n,
            expires_at: undefined,
        };
        const completed = {
            ICRC2: {
                ledger: Principal.fromText(ledger).toUint8Array(),
                token_symbol: "ICP",
                amount: 100_000_000n,
                spender: Principal.fromText(recipient).toUint8Array(),
                from: { Account: addressToIcrcAccount(walletOwner) },
                to: { Account: addressToIcrcAccount(recipient) },
                fee: 10_000n,
                memo: undefined,
                created: 1n,
                block_index: 7n,
            },
        };

        expect(sendMessageSuccess({ ...sent, transfer: undefined })).toMatchObject({
            kind: "success",
            eventIndex: 3,
        });
        expect(
            sendMessageSuccess({ ...sent, transfer: completed }, "sender", recipient),
        ).toMatchObject({
            kind: "transfer_success",
            eventIndex: 3,
            transfer: { kind: "completed", sender: "sender", recipient, blockIndex: 7n },
        });
    });
});

describe("the details of a group or channel returned in full instead of updates", () => {
    test("are mapped as the details of a group are", () => {
        const member = Principal.fromText(walletOwner).toUint8Array();
        const other = Principal.fromText(recipient).toUint8Array();
        const resp = groupDetailsUpdatesResponse(
            {
                SuccessSnapshot: {
                    timestamp: 30n,
                    last_updated: 30n,
                    latest_event_index: 5,
                    participants: [{ user_id: member, date_added: 1n, role: "Owner" }],
                    basic_members: [other],
                    more_members_after: other,
                    bots: [],
                    webhooks: [],
                    chat_rules: { text: "", enabled: false, version: 0 },
                },
            } as never,
            "",
            "aaaaa-aa",
        );

        expect(resp.kind).toBe("snapshot");
        if (resp.kind !== "snapshot") return;
        expect(resp.details.timestamp).toBe(30n);
        expect(resp.details.members.map((m) => m.userId)).toEqual([walletOwner, recipient]);
        expect(resp.details.moreMembersAfter).toBe(recipient);
    });
});

describe("the gate a new chat is created with", () => {
    test("no gate is sent as none", () => {
        expect(apiMaybeAccessGate({ kind: "no_gate" })).toBeUndefined();
    });

    test("every gate the UI offers is sent", () => {
        expect(apiMaybeAccessGate({ kind: "diamond_gate" })).toEqual("DiamondMember");
        expect(apiMaybeAccessGate({ kind: "lifetime_diamond_gate" })).toEqual(
            "LifetimeDiamondMember",
        );
        expect(
            apiMaybeAccessGate({
                kind: "composite_gate",
                operator: "or",
                gates: [{ kind: "lifetime_diamond_gate" }, { kind: "unique_person_gate" }],
            }),
        ).toEqual({
            Composite: { and: false, inner: ["LifetimeDiamondMember", "UniquePerson"] },
        });
    });
});

describe("mini app content mapping", () => {
    const alice = Principal.selfAuthenticating(new Uint8Array(32).fill(1));
    const bob = Principal.selfAuthenticating(new Uint8Array(32).fill(2));
    const bucket = Principal.selfAuthenticating(new Uint8Array(32).fill(3));

    test("maps the card, as the service wrote it", () => {
        const api: TMessageContent = {
            MiniApp: {
                text: "**Uno** · 2 to 4 players",
                image: {
                    width: 600,
                    height: 400,
                    mime_type: "image/png",
                    blob_reference: { canister_id: bucket.toUint8Array(), blob_id: 7n },
                },
                max_players: 4,
                spectators: true,
                status: {
                    Active: {
                        players: [alice.toUint8Array(), bob.toUint8Array()],
                        waiting_for: [bob.toUint8Array()],
                    },
                },
            },
        };

        expect(messageContent(api, "sender")).toEqual({
            kind: "mini_app_content",
            text: "**Uno** · 2 to 4 players",
            image: {
                width: 600,
                height: 400,
                mimeType: "image/png",
                blobReference: { canisterId: bucket.toText(), blobId: 7n },
            },
            maxPlayers: 4,
            spectators: true,
            status: {
                kind: "active",
                players: [alice.toText(), bob.toText()],
                waitingFor: [bob.toText()],
            },
        });
    });

    test("maps a game taking players, and a finished one, with or without a result", () => {
        const status = (status: TMiniAppStatus) => {
            const content = messageContent(
                { MiniApp: { text: "Uno", spectators: false, status } },
                "sender",
            );
            return content.kind === "mini_app_content" ? content.status : undefined;
        };

        expect(status("Open")).toEqual({ kind: "open" });
        expect(
            status({ Finished: { players: [alice.toUint8Array()], result: "Alice won" } }),
        ).toEqual({ kind: "finished", players: [alice.toText()], result: "Alice won" });
        expect(status({ Finished: { players: [] } })).toEqual({
            kind: "finished",
            players: [],
            result: undefined,
        });
    });

    test("isn't sent: only bots post them", () => {
        expect(() =>
            apiMessageContent({
                kind: "mini_app_content",
                text: "Uno",
                spectators: false,
                status: { kind: "open" },
            }),
        ).toThrow();
    });
});

describe("bot permission bits", () => {
    test("message permissions follow the backend's MessagePermission bits, both ways", () => {
        // P2pSwap = 9, VideoCall = 10, MiniApp = 11
        const message = (1 << 9) | (1 << 10) | (1 << 11);
        const permissions = externalBotPermissions({ community: 0, chat: 0, message });

        expect(permissions.messagePermissions).toEqual(["p2pSwap", "videoCall", "miniApp"]);
        expect(apiExternalBotPermissions(permissions).message).toBe(message);
    });
});
