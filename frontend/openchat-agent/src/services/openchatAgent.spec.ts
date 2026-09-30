import { Principal } from "@icp-sdk/core/principal";
import {
    ErrorCode,
    indexedUserId,
    LEDGER_CANISTER_CHAT,
    spenderSubaccount,
    type CryptocurrencyContent,
    type EventWrapper,
    type Message,
    type MessageContent,
    type P2PSwapContentInitial,
    type PendingCryptocurrencyTransfer,
    type TokenInfo,
} from "@shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OpenChatAgent } from "./openchatAgent";

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const FEE = 10n;
const CHAT_FEE = 1_000n;
const ICP: TokenInfo = { ledger: ICP_LEDGER, symbol: "ICP", decimals: 8, fee: FEE };
const ME = Principal.fromText("2vxsx-fae");
const THEM = "rrkah-fqaaa-aaaaa-aaaaq-cai";
const MULTI_USER_CANISTER = Principal.fromText("dfdal-2uaaa-aaaaa-qaama-cai");
const MULTI_USER_CANISTER_USER = indexedUserId(MULTI_USER_CANISTER, 3);
const OTHER_MULTI_USER_CANISTER_USER = indexedUserId(MULTI_USER_CANISTER, 4);
const USER_CANISTER_USER = "renrk-eyaaa-aaaaa-aaada-cai";
const EXTERNAL_ACCOUNT = "rno2w-sqaaa-aaaaa-aaacq-cai";
const DIRECT = { kind: "direct_chat", userId: THEM } as const;
const GROUP = { kind: "group_chat", groupId: "rdmx6-jaaaa-aaaaa-aaadq-cai" } as const;
const CHANNEL = {
    kind: "channel",
    communityId: "rdmx6-jaaaa-aaaaa-aaadq-cai",
    channelId: 1,
} as const;

function transfer(fromAccount?: string): PendingCryptocurrencyTransfer {
    return {
        kind: "pending",
        ledger: ICP_LEDGER,
        token: "ICP",
        recipient: THEM,
        amountE8s: 100n,
        feeE8s: FEE,
        createdAtNanos: 0n,
        fromAccount,
    };
}

function crypto(fromAccount?: string, recipient = THEM): CryptocurrencyContent {
    return {
        kind: "crypto_content",
        caption: undefined,
        transfer: { ...transfer(fromAccount), recipient },
    };
}

function swapOffer(fromAccount?: string): P2PSwapContentInitial {
    return {
        kind: "p2p_swap_content_initial",
        token0: ICP,
        token1: { ledger: LEDGER_CANISTER_CHAT, symbol: "CHAT", decimals: 8, fee: CHAT_FEE },
        token0Amount: 100n,
        token1Amount: 5_000n,
        expiresIn: 1_000n,
        fromAccount,
    };
}

function message(content: MessageContent): EventWrapper<Message> {
    return { event: { content } } as EventWrapper<Message>;
}

// The payments the user's canister pulls from the user's wallet, each of which a user in a
// MultiUser canister has to approve it for first
describe("OpenChatAgent paying from the user's wallet", () => {
    let approvals: unknown[][];
    let approveResponse: "success" | "insufficient_funds" | "failure" | "throws";
    let calls: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function setup(userId: string) {
        const called = (name: string) => () => {
            calls.push(name);
            return Promise.resolve({ kind: "success" });
        };
        agent = Object.create(OpenChatAgent.prototype);
        agent.identity = { getPrincipal: () => ME };
        agent._registryValue = {
            tokenDetails: [
                { ledger: ICP_LEDGER, transferFee: FEE },
                { ledger: LEDGER_CANISTER_CHAT, transferFee: CHAT_FEE },
            ],
        };
        agent._ledgerClient = {
            approveSpending: (...args: unknown[]) => {
                approvals.push(args);
                return approveResponse === "throws"
                    ? Promise.reject(new Error("The ledger couldn't be reached"))
                    : Promise.resolve(approveResponse);
            },
        };
        agent._userClient = {
            userId,
            sendMessage: called("sendMessage"),
            tipMessage: called("tipMessage"),
            acceptP2PSwap: called("acceptP2PSwap"),
            payForStreakInsurance: called("payForStreakInsurance"),
        };
        agent._groupClient = { acceptP2PSwap: called("groupAcceptP2PSwap") };
        agent._communityClient = { acceptP2PSwap: called("communityAcceptP2PSwap") };
        agent._userIndexClient = { payForDiamondMembership: called("payForDiamondMembership") };
    }

    const sendDirectMessage = (content: MessageContent) =>
        agent.sendDirectMessage(
            DIRECT,
            message(content),
            undefined,
            undefined,
            undefined,
            () => {},
        );

    // Every payment, with what it takes from the wallet
    const payments: [string, (fromAccount?: string) => Promise<unknown>, string, bigint][] = [
        [
            "crypto sent in a direct chat",
            (from) => sendDirectMessage(crypto(from)),
            ICP_LEDGER,
            110n,
        ],
        [
            "swap offered in a direct chat",
            (from) => sendDirectMessage(swapOffer(from)),
            ICP_LEDGER,
            120n,
        ],
        [
            "tip in a direct chat",
            (from) => agent.tipMessage({ chatId: DIRECT }, 1n, transfer(from), 8, undefined),
            ICP_LEDGER,
            110n,
        ],
        ...(
            [
                ["a direct chat", DIRECT],
                ["a group", GROUP],
                ["a channel", CHANNEL],
            ] as const
        ).map(([where, chat]): (typeof payments)[number] => [
            `swap accepted in ${where}`,
            (from) => agent.acceptP2PSwap(chat, undefined, 1n, ICP, 100n, undefined, false, from),
            ICP_LEDGER,
            120n,
        ]),
        [
            "Diamond membership",
            (from) => agent.payForDiamondMembership("", ICP_LEDGER, "one_month", false, 100n, from),
            ICP_LEDGER,
            100n,
        ],
    ];

    beforeEach(() => {
        approvals = [];
        approveResponse = "success";
        calls = [];
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    describe("by a user in a MultiUser canister", () => {
        beforeEach(() => setup(MULTI_USER_CANISTER_USER));

        const spender = { owner: MULTI_USER_CANISTER, subaccount: spenderSubaccount(ME) };

        test.each(payments)("%s is approved first", async (_, pay, ledger, amount) => {
            await pay();

            expect(approvals).toEqual([[ledger, spender, amount, FEE]]);
            expect(calls.length).toEqual(1);
        });

        test("streak insurance is approved first, with no fee since it is burned", async () => {
            await agent.payForStreakInsurance(1, 5_000n, undefined);

            expect(approvals).toEqual([[LEDGER_CANISTER_CHAT, spender, 5_000n, CHAT_FEE]]);
            expect(calls).toEqual(["payForStreakInsurance"]);
        });

        test.each(payments)("%s from another account is not", async (_, pay) => {
            await pay(EXTERNAL_ACCOUNT);

            expect(approvals).toEqual([]);
            expect(calls.length).toEqual(1);
        });

        test.each(payments)("%s is not made if it can't be approved", async (_, pay) => {
            approveResponse = "failure";

            const response = await pay();

            expect([response].flat()[0]).toEqual({
                kind: "error",
                code: ErrorCode.ApprovalFailed,
                message: undefined,
            });
            expect(calls).toEqual([]);
        });

        test.each(payments)("%s is not made if the ledger can't be reached", async (_, pay) => {
            approveResponse = "throws";

            const response = await pay();

            expect([response].flat()[0]).toEqual({
                kind: "error",
                code: ErrorCode.ApprovalFailed,
                message: undefined,
            });
            expect(calls).toEqual([]);
        });

        test("streak insurance is not paid for if it can't be approved", async () => {
            approveResponse = "failure";

            expect(await agent.payForStreakInsurance(1, 5_000n, undefined)).toEqual({
                kind: "error",
                code: ErrorCode.ApprovalFailed,
                message: undefined,
            });
            expect(calls).toEqual([]);
        });

        test("nothing is approved while the ledger's fee isn't known", async () => {
            agent._registryValue = undefined;

            const response = await agent.payForDiamondMembership(
                "",
                ICP_LEDGER,
                "one_month",
                false,
                100n,
                undefined,
            );

            expect(response).toEqual({
                kind: "error",
                code: ErrorCode.ApprovalFailed,
                message: undefined,
            });
            expect(approvals).toEqual([]);
            expect(calls).toEqual([]);
        });

        test("crypto for another user in a MultiUser canister is refused before it is approved", async () => {
            const [response] = await sendDirectMessage(
                crypto(undefined, OTHER_MULTI_USER_CANISTER_USER),
            );

            expect(response).toEqual({
                kind: "error",
                code: ErrorCode.RecipientMismatch,
                message: undefined,
            });
            expect(approvals).toEqual([]);
            expect(calls).toEqual([]);
        });

        test("a payment the wallet can't afford is reported as such", async () => {
            approveResponse = "insufficient_funds";

            expect(
                await agent.tipMessage({ chatId: DIRECT }, 1n, transfer(), 8, undefined),
            ).toEqual({
                kind: "error",
                code: ErrorCode.InsufficientFunds,
                message: undefined,
            });
        });

        test("a tip in a group is not approved, since their canister doesn't pull it", async () => {
            await agent.tipMessage({ chatId: GROUP }, 1n, transfer(), 8, undefined);

            expect(approvals).toEqual([]);
            expect(calls).toEqual(["tipMessage"]);
        });

        test("a message which sends no crypto needs no approval", async () => {
            await sendDirectMessage({ kind: "text_content", text: "hello" });

            expect(approvals).toEqual([]);
            expect(calls).toEqual(["sendMessage"]);
        });
    });

    describe("by a user alone in their canister", () => {
        beforeEach(() => setup(USER_CANISTER_USER));

        test.each(payments)("%s needs no approval", async (_, pay) => {
            await pay();

            expect(approvals).toEqual([]);
            expect(calls.length).toEqual(1);
        });

        test("crypto for a user in a MultiUser canister is left to their canister to refuse", async () => {
            await sendDirectMessage(crypto(undefined, OTHER_MULTI_USER_CANISTER_USER));

            expect(approvals).toEqual([]);
            expect(calls).toEqual(["sendMessage"]);
        });

        test("streak insurance needs no approval", async () => {
            await agent.payForStreakInsurance(1, 5_000n, undefined);

            expect(approvals).toEqual([]);
            expect(calls).toEqual(["payForStreakInsurance"]);
        });
    });
});
