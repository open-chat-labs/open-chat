import { Principal } from "@icp-sdk/core/principal";
import type {
    ChannelIdentifier,
    CryptocurrencyContent,
    EventWrapper,
    Message,
    MessageContent,
    P2PSwapContentInitial,
    PendingCryptocurrencyTransfer,
    PrizeContentInitial,
} from "@shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChatsDb } from "../../utils/chatsDb";
import { CommunityClient } from "../community/community.client";
import { GroupClient } from "../group/group.client";
import { addressToIcrcAccount } from "./chatMappersV2";

vi.mock("../data/data.client", () => ({
    DataClient: class {
        uploadData = () => Promise.resolve(undefined);
    },
}));

const CANISTER = "dfdal-2uaaa-aaaaa-qaama-cai";
const CHANNEL: ChannelIdentifier = { kind: "channel", communityId: CANISTER, channelId: 5 };
const LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const SENDER = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const WALLET = Principal.selfAuthenticating(new Uint8Array(32).fill(7)).toText();
const ICP = { fee: 10_000n, decimals: 8, symbol: "ICP", ledger: LEDGER };
const CHAT = { fee: 100_000n, decimals: 8, symbol: "CHAT", ledger: "2ouva-viaaa-aaaaq-aaamq-cai" };

const RECIPIENT = "rdmx6-jaaaa-aaaaa-aaadq-cai";

const transfer: PendingCryptocurrencyTransfer = {
    kind: "pending",
    ledger: LEDGER,
    token: "ICP",
    recipient: RECIPIENT,
    amountE8s: 100_000_000n,
    feeE8s: 10_000n,
    createdAtNanos: 0n,
};

const crypto: CryptocurrencyContent = { kind: "crypto_content", caption: undefined, transfer };

const prize: PrizeContentInitial = {
    kind: "prize_content_initial",
    diamondOnly: false,
    lifetimeDiamondOnly: false,
    uniquePersonOnly: false,
    streakOnly: 0,
    minChitEarned: 0,
    endDate: 1_000n,
    caption: "a prize",
    transfer: { ...transfer, recipient: CANISTER },
    prizes: [40_000_000n, 60_000_000n],
    requiresCaptcha: false,
    fees: 20_000n,
    amount: 100_000_000n,
};

const swap: P2PSwapContentInitial = {
    kind: "p2p_swap_content_initial",
    token0: ICP,
    token1: CHAT,
    token0Amount: 100_000_000n,
    token1Amount: 500_000_000n,
    caption: "an offer",
    expiresIn: 60_000n,
};

function event(content: MessageContent): EventWrapper<Message> {
    return {
        index: 0,
        timestamp: 0n,
        event: {
            kind: "message",
            messageId: 1n,
            messageIndex: 0,
            sender: SENDER,
            content,
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            senderContext: undefined,
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

// What each call made to the canister was sent with
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sent: [string, string, any][];

beforeEach(() => {
    sent = [];
});

// A client whose canister answers that it sent the message, having made the transfer it holds
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function client(prototype: object, content?: MessageContent): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chatsDb = Object.create(ChatsDb.prototype) as any;
    chatsDb.removeFailedMessage = () => Promise.resolve();
    chatsDb.setCachedMessageIfNotExists = () => Promise.resolve();

    const completed = {
        ICRC2: {
            ledger: Principal.fromText(LEDGER).toUint8Array(),
            token_symbol: "ICP",
            amount: 100_000_000n,
            spender: Principal.fromText(CANISTER).toUint8Array(),
            from: { Account: addressToIcrcAccount(WALLET) },
            to: { Account: addressToIcrcAccount(CANISTER) },
            fee: 10_000n,
            memo: undefined,
            created: 1n,
            block_index: 7n,
        },
    };
    const success = {
        event_index: 3,
        message_index: 2,
        timestamp: 10n,
        expires_at: undefined,
        transfer: content === undefined ? undefined : completed,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = Object.create(prototype) as any;
    client.chatsDb = chatsDb;
    client.update = (
        canisterId: string,
        method: string,
        args: unknown,
        mapper: (resp: unknown) => unknown,
    ) => {
        sent.push([canisterId, method, args]);
        return Promise.resolve(mapper(content === undefined ? "Success" : { Success: success }));
    };
    return client;
}

function sendToGroup(content: MessageContent, thread?: number): Promise<[unknown, Message]> {
    return client(GroupClient.prototype, content).sendMessage(
        CANISTER,
        "sender",
        undefined,
        [],
        event(content),
        thread,
        undefined,
        undefined,
        false,
        () => {},
        WALLET,
    );
}

function sendToChannel(content: MessageContent, thread?: number): Promise<[unknown, Message]> {
    return client(CommunityClient.prototype, content).sendMessage(
        CHANNEL,
        "sender",
        undefined,
        [],
        event(content),
        thread,
        undefined,
        undefined,
        undefined,
        false,
        () => {},
        WALLET,
    );
}

// A group or community makes a prize or swap offer from the content it is sent, and the message
// is only read again once it changes, so what comes back is what its sender sees until then
describe.each([
    ["a group", sendToGroup, "send_message_v2"],
    ["a channel", sendToChannel, "send_message"],
])("sending a message straight to %s", (_, send, method) => {
    const from = { ICRC2: { from: addressToIcrcAccount(WALLET) } };

    test("crypto is sent as pulled from the wallet, in its thread", async () => {
        await send(crypto, 7);

        expect(sent).toMatchObject([
            [
                CANISTER,
                method,
                {
                    thread_root_message_index: 7,
                    content: { Crypto: { transfer: { Pending: from } } },
                },
            ],
        ]);
    });

    test("a prize is sent as pulled from the wallet", async () => {
        await send(prize);

        expect(sent).toMatchObject([
            [CANISTER, method, { content: { Prize: { transfer: { Pending: from } } } }],
        ]);
    });

    // The group or community pulls a swap offer from the wallet of the member offering it
    test("a swap offer names no account to be pulled from", async () => {
        await send(swap);

        expect(sent).toMatchObject([[CANISTER, method, { content: { P2PSwap: {} } }]]);
        expect(sent[0][2].content.P2PSwap.from_account).toBeUndefined();
    });

    test("a prize whose transfer was made comes back as the prize", async () => {
        const [resp, message] = await send(prize);

        expect(resp).toMatchObject({ kind: "transfer_success", eventIndex: 3 });
        expect(message).toMatchObject({
            messageIndex: 2,
            content: {
                kind: "prize_content",
                prizesRemaining: 2,
                token: "ICP",
                caption: "a prize",
            },
        });
    });

    test("a swap offer whose transfer was made comes back as the offer", async () => {
        const [resp, message] = await send(swap);

        expect(resp).toMatchObject({ kind: "transfer_success", eventIndex: 3 });
        expect(message).toMatchObject({
            messageIndex: 2,
            content: {
                kind: "p2p_swap_content",
                token0Amount: 100_000_000n,
                token1Amount: 500_000_000n,
                status: { kind: "p2p_swap_open" },
                token0TxnIn: 7n,
            },
        });
    });
});

describe.each([
    [
        "a group",
        (thread?: number) =>
            client(GroupClient.prototype).tipMessage(
                CANISTER,
                thread,
                1n,
                { ...transfer, fromAccount: WALLET },
                8,
                "sender",
                "Sender",
                true,
            ),
        {},
    ],
    [
        "a channel",
        (thread?: number) =>
            client(CommunityClient.prototype).tipMessage(
                CHANNEL,
                thread,
                1n,
                { ...transfer, fromAccount: WALLET },
                8,
                "sender",
                "Sender",
                true,
            ),
        { channel_id: 5n },
    ],
])("tipping a message straight in %s", (_, tip, channel) => {
    test("the tip is sent as pulled from the wallet, to the message's author, in its thread", async () => {
        expect(await tip(7)).toMatchObject({ kind: "success" });

        expect(sent).toMatchObject([
            [
                CANISTER,
                "tip_message",
                {
                    ...channel,
                    thread_root_message_index: 7,
                    message_id: 1n,
                    transfer: {
                        ICRC2: {
                            from: addressToIcrcAccount(WALLET),
                            to: addressToIcrcAccount(RECIPIENT),
                            amount: 100_000_000n,
                            fee: 10_000n,
                        },
                    },
                    decimals: 8,
                    username: "sender",
                    display_name: "Sender",
                    new_achievement: true,
                },
            ],
        ]);
    });
});
