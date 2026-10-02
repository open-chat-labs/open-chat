import { Principal } from "@icp-sdk/core/principal";
import {
    APPROVAL_VALIDITY_MS,
    ErrorCode,
    indexedUserId,
    LEDGER_CANISTER_CHAT,
    spenderSubaccount,
    Stream,
    type CryptocurrencyContent,
    type EventWrapper,
    type Message,
    type MessageContent,
    type P2PSwapContentInitial,
    type PendingCryptocurrencyTransfer,
    type PendingCryptocurrencyWithdrawal,
    type PrizeContentInitial,
    type TokenInfo,
} from "@shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AsyncMessageContextMap } from "../utils/messageContext";
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

function prize(fromAccount?: string): PrizeContentInitial {
    return {
        kind: "prize_content_initial",
        diamondOnly: false,
        lifetimeDiamondOnly: false,
        uniquePersonOnly: false,
        streakOnly: 0,
        minChitEarned: 0,
        endDate: 0n,
        transfer: transfer(fromAccount),
        prizes: [50n, 40n],
        requiresCaptcha: false,
        fees: 10n,
        amount: 90n,
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
    let callArgs: unknown[][];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function setup(userId: string) {
        const called =
            (name: string) =>
            (...args: unknown[]) => {
                calls.push(name);
                callArgs.push(args);
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
            sendMessageWithTransferToGroup: called("sendMessageWithTransferToGroup"),
            sendMessageWithTransferToChannel: called("sendMessageWithTransferToChannel"),
            tipMessage: called("tipMessage"),
            acceptP2PSwap: called("acceptP2PSwap"),
            payForStreakInsurance: called("payForStreakInsurance"),
        };
        agent._groupClient = {
            acceptP2PSwap: called("groupAcceptP2PSwap"),
            sendMessage: called("groupSendMessage"),
            tipMessage: called("groupTipMessage"),
        };
        agent._communityClient = {
            acceptP2PSwap: called("communityAcceptP2PSwap"),
            sendMessage: called("communitySendMessage"),
            tipMessage: called("communityTipMessage"),
        };
        agent._userIndexClient = { payForDiamondMembership: called("payForDiamondMembership") };
    }

    // Sends a message to a group or channel, giving the response once it is final
    const send = (
        chatId: typeof GROUP | typeof CHANNEL,
        content: MessageContent,
        threadRootMessageIndex?: number,
        acceptedRules?: { chat: number; community: number },
    ) =>
        new Promise((resolve, reject) =>
            agent
                .sendMessage(
                    { chatId, threadRootMessageIndex },
                    { username: "me", displayName: undefined },
                    [],
                    message(content),
                    acceptedRules,
                    undefined,
                    undefined,
                    false,
                )
                .subscribe({
                    onResult: (response: unknown, final: boolean) => final && resolve(response),
                    onError: reject,
                }),
        );

    // Each kind of message holding a transfer, with what it takes from the wallet
    const transferMessages: [string, () => MessageContent, bigint][] = [
        ["crypto", crypto, 110n],
        ["a prize", prize, 110n],
        ["a swap offer", swapOffer, 120n],
    ];

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
        callArgs = [];
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    describe("by a user in a MultiUser canister", () => {
        beforeEach(() => setup(MULTI_USER_CANISTER_USER));

        const spender = { owner: MULTI_USER_CANISTER, subaccount: spenderSubaccount(ME) };

        test.each(payments)("%s is approved first", async (_, pay, ledger, amount) => {
            await pay();

            expect(approvals).toEqual([[ledger, spender, amount, FEE, APPROVAL_VALIDITY_MS]]);
            expect(calls.length).toEqual(1);
        });

        test("streak insurance is approved first, with no fee since it is burned", async () => {
            await agent.payForStreakInsurance(1, 5_000n, undefined);

            expect(approvals).toEqual([
                [LEDGER_CANISTER_CHAT, spender, 5_000n, CHAT_FEE, APPROVAL_VALIDITY_MS],
            ]);
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

        test("crypto for another user in a MultiUser canister is approved and sent like any other", async () => {
            await sendDirectMessage(crypto(undefined, OTHER_MULTI_USER_CANISTER_USER));

            expect(approvals).toEqual([[ICP_LEDGER, spender, 110n, FEE, APPROVAL_VALIDITY_MS]]);
            expect(calls).toEqual(["sendMessage"]);
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

        describe("in a group or channel", () => {
            const spender = (canisterId: string) => ({
                owner: Principal.fromText(canisterId),
                subaccount: spenderSubaccount(ME),
            });

            test.each(transferMessages)(
                "%s in a group is pulled from their wallet by the group, once approved to",
                async (_, content, amount) => {
                    await send(GROUP, content());

                    expect(approvals).toEqual([
                        [ICP_LEDGER, spender(GROUP.groupId), amount, FEE, APPROVAL_VALIDITY_MS],
                    ]);
                    expect(calls).toEqual(["groupSendMessage"]);
                    expect(callArgs[0].at(-1)).toEqual(ME.toText());
                },
            );

            test.each(transferMessages)(
                "%s in a channel is pulled from their wallet by the community, once approved to",
                async (_, content, amount) => {
                    await send(CHANNEL, content());

                    expect(approvals).toEqual([
                        [
                            ICP_LEDGER,
                            spender(CHANNEL.communityId),
                            amount,
                            FEE,
                            APPROVAL_VALIDITY_MS,
                        ],
                    ]);
                    expect(calls).toEqual(["communitySendMessage"]);
                    expect(callArgs[0].at(-1)).toEqual(ME.toText());
                },
            );

            test("a message isn't sent if its transfer can't be approved", async () => {
                approveResponse = "failure";

                const [response] = (await send(GROUP, crypto())) as unknown[];

                expect(response).toEqual({
                    kind: "error",
                    code: ErrorCode.ApprovalFailed,
                    message: undefined,
                });
                expect(calls).toEqual([]);
            });

            test("a transfer in a thread is sent to the group in that thread, with the rules accepted", async () => {
                await send(GROUP, crypto(), 7, { chat: 2, community: 3 });

                expect(callArgs[0]).toEqual([
                    GROUP.groupId,
                    "me",
                    undefined,
                    [],
                    message(crypto()),
                    7,
                    2,
                    undefined,
                    false,
                    expect.any(Function),
                    ME.toText(),
                ]);
            });

            test("a transfer in a thread is sent to the community in that thread, with the rules accepted", async () => {
                await send(CHANNEL, crypto(), 7, { chat: 2, community: 3 });

                expect(callArgs[0]).toEqual([
                    CHANNEL,
                    "me",
                    undefined,
                    [],
                    message(crypto()),
                    7,
                    3,
                    2,
                    undefined,
                    false,
                    expect.any(Function),
                    ME.toText(),
                ]);
            });

            // The wallet isn't asked to approve anything, since the transfer isn't from it
            test("a transfer from another account is left to the group to pull", async () => {
                await send(GROUP, crypto(EXTERNAL_ACCOUNT));

                expect(approvals).toEqual([]);
                expect(calls).toEqual(["groupSendMessage"]);
            });

            test("a message without a transfer needs no approval", async () => {
                await send(GROUP, { kind: "text_content", text: "hello" });

                expect(approvals).toEqual([]);
                expect(calls).toEqual(["groupSendMessage"]);
                expect(callArgs[0].length).toEqual(10);
            });

            test.each([
                ["group", GROUP, GROUP.groupId, "groupTipMessage"],
                ["channel", CHANNEL, CHANNEL.communityId, "communityTipMessage"],
            ] as const)(
                "a tip in a %s is pulled from their wallet by it, once approved to",
                async (_, chatId, canisterId, call) => {
                    await agent.tipMessage(
                        { chatId },
                        1n,
                        transfer(),
                        8,
                        undefined,
                        "me",
                        undefined,
                        true,
                    );

                    expect(approvals).toEqual([
                        [ICP_LEDGER, spender(canisterId), 110n, FEE, APPROVAL_VALIDITY_MS],
                    ]);
                    expect(calls).toEqual([call]);
                    expect(callArgs[0][3]).toEqual({ ...transfer(), fromAccount: ME.toText() });
                },
            );

            test.each([
                ["group", GROUP, GROUP.groupId, "groupTipMessage"],
                ["channel", CHANNEL, CHANNEL, "communityTipMessage"],
            ] as const)(
                "a tip in a thread in a %s is given in that thread",
                async (_, chatId, to, call) => {
                    await agent.tipMessage(
                        { chatId, threadRootMessageIndex: 7 },
                        1n,
                        transfer(),
                        8,
                        undefined,
                        "me",
                        "Me",
                        true,
                    );

                    expect(calls).toEqual([call]);
                    expect(callArgs[0]).toEqual([
                        to,
                        7,
                        1n,
                        { ...transfer(), fromAccount: ME.toText() },
                        8,
                        "me",
                        "Me",
                        true,
                    ]);
                },
            );

            test("a tip from another account is left to the group to pull", async () => {
                await agent.tipMessage(
                    { chatId: GROUP },
                    1n,
                    transfer(EXTERNAL_ACCOUNT),
                    8,
                    undefined,
                    "me",
                    undefined,
                    true,
                );

                expect(approvals).toEqual([]);
                expect(calls).toEqual(["groupTipMessage"]);
                expect(callArgs[0][3]).toEqual(transfer(EXTERNAL_ACCOUNT));
            });

            test("a tip isn't given if it can't be approved", async () => {
                approveResponse = "insufficient_funds";

                expect(
                    await agent.tipMessage(
                        { chatId: GROUP },
                        1n,
                        transfer(),
                        8,
                        undefined,
                        "me",
                        undefined,
                        true,
                    ),
                ).toEqual({ kind: "error", code: ErrorCode.InsufficientFunds, message: undefined });
                expect(calls).toEqual([]);
            });
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

        test.each(transferMessages)(
            "%s in a group is sent via their canister, which makes the transfer",
            async (_, content) => {
                await send(GROUP, content());

                expect(approvals).toEqual([]);
                expect(calls).toEqual(["sendMessageWithTransferToGroup"]);
            },
        );

        test.each(transferMessages)(
            "%s in a channel is sent via their canister, which makes the transfer",
            async (_, content) => {
                await send(CHANNEL, content());

                expect(approvals).toEqual([]);
                expect(calls).toEqual(["sendMessageWithTransferToChannel"]);
            },
        );

        test.each([
            ["group", GROUP],
            ["channel", CHANNEL],
        ] as const)(
            "a tip in a %s is given via their canister, which makes the transfer",
            async (_, chatId) => {
                await agent.tipMessage(
                    { chatId },
                    1n,
                    transfer(),
                    8,
                    undefined,
                    "me",
                    undefined,
                    true,
                );

                expect(approvals).toEqual([]);
                expect(calls).toEqual(["tipMessage"]);
            },
        );

        test("streak insurance needs no approval", async () => {
            await agent.payForStreakInsurance(1, 5_000n, undefined);

            expect(approvals).toEqual([]);
            expect(calls).toEqual(["payForStreakInsurance"]);
        });
    });
});

// The wallet's "Send"
describe("OpenChatAgent withdrawing from the user's wallet", () => {
    const WITHDRAWAL: PendingCryptocurrencyWithdrawal = {
        kind: "pending",
        ledger: ICP_LEDGER,
        token: "ICP",
        to: EXTERNAL_ACCOUNT,
        amountE8s: 100n,
        feeE8s: FEE,
        createdAtNanos: 0n,
    };
    const PIN = "1234";
    const LEDGER_RESPONSE = {
        kind: "error",
        code: ErrorCode.InsufficientFunds,
        message: undefined,
    };
    const CANISTER_RESPONSE = { kind: "error", code: ErrorCode.PinIncorrect, message: undefined };

    let ledgerWithdrawals: unknown[][];
    let canisterWithdrawals: unknown[][];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function setup(userId: string) {
        ledgerWithdrawals = [];
        canisterWithdrawals = [];
        agent = Object.create(OpenChatAgent.prototype);
        agent.identity = { getPrincipal: () => ME };
        agent._ledgerClient = {
            withdraw: (...args: unknown[]) => {
                ledgerWithdrawals.push(args);
                return Promise.resolve(LEDGER_RESPONSE);
            },
        };
        agent._userClient = {
            userId,
            withdrawCryptocurrency: (...args: unknown[]) => {
                canisterWithdrawals.push(args);
                return Promise.resolve(CANISTER_RESPONSE);
            },
        };
    }

    test("a user in a MultiUser canister sends from their wallet on the ledger, with no PIN", async () => {
        setup(MULTI_USER_CANISTER_USER);

        expect(await agent.withdrawCryptocurrency(WITHDRAWAL, PIN)).toBe(LEDGER_RESPONSE);
        expect(ledgerWithdrawals).toEqual([[WITHDRAWAL]]);
        expect(canisterWithdrawals).toEqual([]);
    });

    test("a user alone in their canister has it send from its account, with their PIN", async () => {
        setup(USER_CANISTER_USER);

        expect(await agent.withdrawCryptocurrency(WITHDRAWAL, PIN)).toBe(CANISTER_RESPONSE);
        expect(canisterWithdrawals).toEqual([[WITHDRAWAL, PIN]]);
        expect(ledgerWithdrawals).toEqual([]);
    });
});

// A user migrated to a MultiUser canister may have left funds in the wallet of their previous
// canister, which only the LocalUserIndex controlling that canister can move to their wallet
describe("OpenChatAgent moving funds from the user's previous wallets", () => {
    const canisterId = (n: number) =>
        Principal.fromUint8Array(new Uint8Array([0, 0, 0, 0, 0, 0, 0x10, n, 1, 1])).toText();
    const PREVIOUS = canisterId(1);
    const OTHER_PREVIOUS = canisterId(2);
    const LOCAL_USER_INDEX = canisterId(3);
    const OTHER_LOCAL_USER_INDEX = canisterId(4);
    const DEAD_LEDGER = canisterId(5);
    const CANISTER_NOT_FOUND = {
        kind: "error",
        code: ErrorCode.CanisterNotFound,
        message: undefined,
    };

    let balances: Map<string, bigint>;
    let balanceOwners: Set<string>;
    let controllers: Map<string, string[] | Error>;
    let controllerLookups: string[];
    let moves: [string, string, string[]][];
    let moveResponse: (localUserIndex: string, ledgers: string[]) => unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    beforeEach(() => {
        balances = new Map();
        balanceOwners = new Set();
        controllers = new Map([
            [PREVIOUS, [OTHER_LOCAL_USER_INDEX, LOCAL_USER_INDEX]],
            [OTHER_PREVIOUS, [LOCAL_USER_INDEX]],
        ]);
        controllerLookups = [];
        moves = [];
        moveResponse = (localUserIndex, ledgers) =>
            localUserIndex === LOCAL_USER_INDEX
                ? { kind: "success", outcomes: ledgers.map((ledger) => moved(ledger)) }
                : CANISTER_NOT_FOUND;

        agent = Object.create(OpenChatAgent.prototype);
        agent.identity = { getPrincipal: () => ME };
        agent._userClient = { userId: MULTI_USER_CANISTER_USER };
        agent._registryValue = {
            tokenDetails: [
                { ledger: ICP_LEDGER, transferFee: FEE },
                { ledger: LEDGER_CANISTER_CHAT, transferFee: CHAT_FEE },
                { ledger: DEAD_LEDGER, transferFee: FEE },
            ],
        };
        agent._ledgerClient = {
            accountBalance: (ledger: string, account: { owner: Principal }) => {
                const owner = account.owner.toText();
                balanceOwners.add(owner);
                return ledger === DEAD_LEDGER
                    ? Promise.reject(new Error("The ledger has no wasm module"))
                    : Promise.resolve(balances.get(`${owner}:${ledger}`) ?? 0n);
            },
        };
        agent.canisterControllers = (canisterId: string) => {
            controllerLookups.push(canisterId);
            const result = controllers.get(canisterId) ?? [];
            return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
        };
        agent._localUserIndexClient = {
            moveFundsFromOldCanister: async (
                localUserIndex: string,
                oldUserId: string,
                ledgers: string[],
            ) => {
                moves.push([localUserIndex, oldUserId, ledgers]);
                return moveResponse(localUserIndex, ledgers);
            },
        };
    });

    function moved(ledger: string) {
        return { ledger, result: { kind: "moved", amount: 100n, fee: FEE, blockIndex: 1n } };
    }

    function funds(previousUserId: string, ledgers: string[]) {
        return ledgers.map((ledger) => ({ previousUserId, ledger, balance: 1_000_000n }));
    }

    test("finds the balances above the fee on each token in the wallets of previous canisters", async () => {
        balances.set(`${PREVIOUS}:${ICP_LEDGER}`, FEE + 1n);
        balances.set(`${PREVIOUS}:${LEDGER_CANISTER_CHAT}`, CHAT_FEE);
        balances.set(`${OTHER_PREVIOUS}:${LEDGER_CANISTER_CHAT}`, 5_000n);

        // A previous id in a MultiUser canister had no wallet of its own, and the dead ledger's
        // balances can't be read
        const found = await agent.fundsInPreviousWallets([
            PREVIOUS,
            OTHER_MULTI_USER_CANISTER_USER,
            OTHER_PREVIOUS,
        ]);

        expect(found).toEqual([
            { previousUserId: PREVIOUS, ledger: ICP_LEDGER, balance: FEE + 1n },
            { previousUserId: OTHER_PREVIOUS, ledger: LEDGER_CANISTER_CHAT, balance: 5_000n },
        ]);
        expect(balanceOwners).toEqual(new Set([PREVIOUS, OTHER_PREVIOUS]));
    });

    test("moves through the LocalUserIndex controlling each previous canister, one canister at a time", async () => {
        const events: string[] = [];
        moveResponse = async (localUserIndex, ledgers) => {
            events.push(`start ${ledgers.join(",")}`);
            await new Promise((resolve) => setTimeout(resolve, 0));
            events.push(`end ${ledgers.join(",")}`);
            return localUserIndex === LOCAL_USER_INDEX
                ? { kind: "success", outcomes: ledgers.map((ledger) => moved(ledger)) }
                : CANISTER_NOT_FOUND;
        };

        const outcomes = await agent.moveFundsFromPreviousWallets([
            ...funds(PREVIOUS, [ICP_LEDGER, LEDGER_CANISTER_CHAT]),
            ...funds(OTHER_PREVIOUS, [ICP_LEDGER]),
        ]);

        expect(moves).toEqual([
            [OTHER_LOCAL_USER_INDEX, PREVIOUS, [ICP_LEDGER, LEDGER_CANISTER_CHAT]],
            [LOCAL_USER_INDEX, PREVIOUS, [ICP_LEDGER, LEDGER_CANISTER_CHAT]],
            [LOCAL_USER_INDEX, OTHER_PREVIOUS, [ICP_LEDGER]],
        ]);
        expect(events.every((e, i) => e.startsWith(i % 2 === 0 ? "start" : "end"))).toBe(true);
        expect(outcomes).toEqual([
            { previousUserId: PREVIOUS, ...moved(ICP_LEDGER) },
            { previousUserId: PREVIOUS, ...moved(LEDGER_CANISTER_CHAT) },
            { previousUserId: OTHER_PREVIOUS, ...moved(ICP_LEDGER) },
        ]);
    });

    test("moves at most 20 ledgers a call, from the LocalUserIndex found for the first", async () => {
        const ledgers = Array.from({ length: 25 }, (_, i) => canisterId(100 + i));

        const outcomes = await agent.moveFundsFromPreviousWallets(funds(PREVIOUS, ledgers));

        expect(moves).toEqual([
            [OTHER_LOCAL_USER_INDEX, PREVIOUS, ledgers.slice(0, 20)],
            [LOCAL_USER_INDEX, PREVIOUS, ledgers.slice(0, 20)],
            [LOCAL_USER_INDEX, PREVIOUS, ledgers.slice(20)],
        ]);
        expect(controllerLookups).toEqual([PREVIOUS]);
        expect(outcomes.map((o: { ledger: string }) => o.ledger)).toEqual(ledgers);
    });

    test("each ledger in a call which fails fails with its error", async () => {
        const inProgress = {
            kind: "error",
            code: ErrorCode.AlreadyInProgress,
            message: "Old canister not yet uninstalled",
        };
        moveResponse = () => inProgress;

        expect(await agent.moveFundsFromPreviousWallets(funds(PREVIOUS, [ICP_LEDGER]))).toEqual([
            {
                previousUserId: PREVIOUS,
                ledger: ICP_LEDGER,
                result: { kind: "failed", error: inProgress },
            },
        ]);
    });

    test("each ledger fails if no LocalUserIndex controls the previous canister", async () => {
        controllers.set(PREVIOUS, [OTHER_LOCAL_USER_INDEX]);

        expect(await agent.moveFundsFromPreviousWallets(funds(PREVIOUS, [ICP_LEDGER]))).toEqual([
            {
                previousUserId: PREVIOUS,
                ledger: ICP_LEDGER,
                result: { kind: "failed", error: CANISTER_NOT_FOUND },
            },
        ]);
    });

    test("each ledger fails if the previous canister's controllers can't be read", async () => {
        controllers.set(PREVIOUS, new Error("read_state failed"));

        const outcomes = await agent.moveFundsFromPreviousWallets([
            ...funds(PREVIOUS, [ICP_LEDGER]),
            ...funds(OTHER_PREVIOUS, [ICP_LEDGER]),
        ]);

        expect(outcomes).toEqual([
            {
                previousUserId: PREVIOUS,
                ledger: ICP_LEDGER,
                result: {
                    kind: "failed",
                    error: {
                        kind: "error",
                        code: ErrorCode.Unknown,
                        message: "Error: read_state failed",
                    },
                },
            },
            { previousUserId: OTHER_PREVIOUS, ...moved(ICP_LEDGER) },
        ]);
        expect(moves).toEqual([[LOCAL_USER_INDEX, OTHER_PREVIOUS, [ICP_LEDGER]]]);
    });
});

// A user migrated to a MultiUser canister is referred to by their earlier id in the events from
// before then, which the agent replaces with their current id
describe("OpenChatAgent referring to the user by their current id", () => {
    const PREVIOUS = USER_CANISTER_USER;
    const CURRENT = MULTI_USER_CANISTER_USER;
    const GROUP_ID = { kind: "group_chat", groupId: "rdmx6-jaaaa-aaaaa-aaadq-cai" } as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function agent(previousUserIds: string[]): any {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agent = Object.create(OpenChatAgent.prototype) as any;
        agent._ownLatestUserIds = new Map(previousUserIds.map((id) => [id, CURRENT]));
        return agent;
    }

    function sentBy(sender: string): EventWrapper<Message> {
        return {
            index: 3,
            timestamp: 10n,
            event: {
                kind: "message",
                messageId: 1n,
                messageIndex: 2,
                sender,
                content: { kind: "text_content", text: "hello" },
                reactions: [{ reaction: "👍", userIds: new Set([sender, THEM]) }],
                tips: { [ICP_LEDGER]: { [sender]: 100n } },
                edited: false,
                forwarded: false,
                deleted: false,
                blockLevelMarkdown: false,
                senderContext: undefined,
                ogPreviews: [],
                messagePreviews: [],
            },
        } as EventWrapper<Message>;
    }

    function rehydrated(previousUserIds: string[], event: EventWrapper<Message>) {
        return agent(previousUserIds).rehydrateEvent(
            event,
            GROUP_ID,
            new AsyncMessageContextMap(),
            { messages: new AsyncMessageContextMap(), previews: new Map() },
            undefined,
        );
    }

    test("an event from before they were migrated is from their current id", () => {
        expect(rehydrated([PREVIOUS], sentBy(PREVIOUS)).event).toMatchObject({
            sender: CURRENT,
            reactions: [{ reaction: "👍", userIds: new Set([CURRENT, THEM]) }],
            tips: { [ICP_LEDGER]: { [CURRENT]: 100n } },
        });
    });

    test("an event from anyone else, or for a user who wasn't migrated, is left as it is", () => {
        const fromThem = sentBy(THEM);
        expect(rehydrated([PREVIOUS], fromThem)).toBe(fromThem);

        const fromPrevious = sentBy(PREVIOUS);
        expect(rehydrated([], fromPrevious)).toBe(fromPrevious);
    });

    // Runs `getCurrentUser` with the given results, the last being the live one, as the session
    // `sessionUserId`, returning the mapping after each
    async function mappingsAfter(
        sessionUserId: string,
        results: { userId: string; previousUserIds?: string[] }[],
    ) {
        const user = agent([]);
        user._userClient = { userId: sessionUserId };
        user._userIndexClient = {
            getCurrentUser: () =>
                new Stream((resolve) =>
                    queueMicrotask(() =>
                        results.forEach((r, i) =>
                            resolve({ kind: "created_user", ...r }, i === results.length - 1),
                        ),
                    ),
                ),
        };
        const seen: Map<string, string>[] = [];
        await new Promise<void>((done) =>
            user.getCurrentUser().subscribe({
                onResult: (_: unknown, final: boolean) => {
                    seen.push(new Map(user._ownLatestUserIds));
                    if (final) done();
                },
            }),
        );
        return { user, seen };
    }

    test("the previous ids are taken from each current user result, the cached one then the live one", async () => {
        // A user cached before their previous ids were, then the live one
        const { seen } = await mappingsAfter(CURRENT, [
            { userId: CURRENT },
            { userId: CURRENT, previousUserIds: [PREVIOUS] },
        ]);

        expect(seen).toEqual([new Map(), new Map([[PREVIOUS, CURRENT]])]);
    });

    test("the user's ids are mapped to the one the session is under", async () => {
        // Before the user client is created, the result's own id
        const before = await mappingsAfter("anon", [
            { userId: CURRENT, previousUserIds: [PREVIOUS] },
        ]);
        expect(before.seen).toEqual([new Map([[PREVIOUS, CURRENT]])]);

        // A session carrying on under the earlier id, which the client does if it can't restart
        // under the latest, has what they did under the latest mapped back to it
        const stayed = await mappingsAfter(PREVIOUS, [
            { userId: PREVIOUS },
            { userId: CURRENT, previousUserIds: [PREVIOUS] },
        ]);
        expect(stayed.seen).toEqual([new Map(), new Map([[CURRENT, PREVIOUS]])]);

        // And once the session's user client is created under the latest id, the other way round
        stayed.user._chatEventsReader = { setUserClient: () => {} };
        stayed.user.createUserClient(CURRENT);
        expect(stayed.user._ownLatestUserIds).toEqual(new Map([[PREVIOUS, CURRENT]]));
    });

    test("an id which isn't one of the user's maps nothing onto the session's", async () => {
        // eg. a new account on the same principal as a deleted one
        const { seen } = await mappingsAfter(THEM, [{ userId: THEM }, { userId: CURRENT }]);

        expect(seen).toEqual([new Map(), new Map()]);
    });

    test("a reply to a message from before they were migrated is from their current id", () => {
        const missingReplies = new AsyncMessageContextMap<EventWrapper<Message>>();
        missingReplies.insert(
            { chatId: GROUP_ID, threadRootMessageIndex: undefined },
            {
                ...sentBy(PREVIOUS),
                index: 7,
            },
        );
        const reply = sentBy(THEM);
        reply.event.repliesTo = {
            kind: "raw_reply_context",
            eventIndex: 7,
        } as unknown as Message["repliesTo"];

        const replied = agent([PREVIOUS]).rehydrateEvent(
            reply,
            GROUP_ID,
            missingReplies,
            { messages: new AsyncMessageContextMap(), previews: new Map() },
            undefined,
        );

        expect(replied.event.repliesTo).toMatchObject({
            kind: "rehydrated_reply_context",
            senderId: CURRENT,
        });
    });

    test("a message which failed before they were migrated is from their current id", async () => {
        const user = agent([PREVIOUS]);
        const failed = { 2: sentBy(PREVIOUS) };
        user._chatsDb = {
            loadFailedMessages: () => Promise.resolve({ toMap: () => new Map([["chat", failed]]) }),
        };

        const loaded = await user.loadFailedMessages();

        expect(loaded.get("chat")[2].event.sender).toEqual(CURRENT);
    });

    test("a message deleted or undeleted from before they were migrated refers to their current id", async () => {
        const user = agent([PREVIOUS]);
        const content = crypto(undefined, PREVIOUS);
        user._userClient = {
            getDeletedMessage: () => Promise.resolve({ kind: "success", content }),
            undeleteMessage: () =>
                Promise.resolve({
                    kind: "success",
                    message: { ...sentBy(PREVIOUS).event, content },
                }),
        };
        user._groupClient = {
            getDeletedMessage: () => Promise.resolve({ kind: "success", content }),
        };

        const direct = await user.getDeletedDirectMessage(THEM, 1n);
        const group = await user.getDeletedGroupMessage(GROUP_ID, 1n);
        const undeleted = await user.undeleteMessage({ kind: "direct_chat", userId: THEM }, 1n);

        expect(direct.content.transfer.recipient).toEqual(CURRENT);
        expect(group.content.transfer.recipient).toEqual(CURRENT);
        expect(undeleted.message).toMatchObject({
            sender: CURRENT,
            content: { transfer: { recipient: CURRENT } },
        });
    });

    test("a chat's latest message from before they were migrated is from their current id", () => {
        const chat = { kind: "direct_chat", them: THEM, latestMessage: sentBy(PREVIOUS) };

        expect(agent([PREVIOUS]).hydrateChatSummary(chat).latestMessage.event.sender).toEqual(
            CURRENT,
        );
        // The other user in the chat is left as they are
        expect(agent([THEM]).hydrateChatSummary(chat).them).toEqual(THEM);
    });
});

// Approvals the website asks for directly, for a group or community to pull an access gate's
// payment when the user joins, and for the ProposalsBot, Registry or UserIndex to pull what a
// proposal costs
describe("OpenChatAgent approving a spender", () => {
    const PROPOSALS_BOT = "rno2w-sqaaa-aaaaa-aaacq-cai";
    const FIVE_MINUTES = 5n * 60n * 1000n;
    // What the website approves for a gate of 1,000: the gate's amount less the approval's fee, so
    // that the user pays exactly the gate's amount. The group pulls it less another fee, plus the
    // fee for pulling it.
    const GATE_APPROVAL = 1_000n - FEE;

    let approvals: unknown[][];
    let approveResponse: "success" | "insufficient_funds" | "failure";
    let userCanisterApprovals: unknown[][];
    let submitted: unknown[][];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function setup(userId: string) {
        agent = Object.create(OpenChatAgent.prototype);
        agent.identity = { getPrincipal: () => ME };
        agent._registryValue = { tokenDetails: [{ ledger: ICP_LEDGER, transferFee: FEE }] };
        agent._ledgerClient = {
            approveSpending: (...args: unknown[]) => {
                approvals.push(args);
                return Promise.resolve(approveResponse);
            },
        };
        agent._userClient = {
            userId,
            approveTransfer: (...args: unknown[]) => {
                userCanisterApprovals.push(args);
                return Promise.resolve({ kind: "success" });
            },
        };
        agent._proposalsBotClient = {
            get: () => ({
                submitProposal: (...args: unknown[]) => {
                    submitted.push(args);
                    return Promise.resolve({ kind: "success" });
                },
            }),
        };
    }

    // A group or community pulls a gate's payment as the member's spender account, while the
    // ProposalsBot pulls a proposal's fee as its own default account
    const memberSpender = (canisterId: string) => ({
        owner: Principal.fromText(canisterId),
        subaccount: spenderSubaccount(ME),
    });
    const proposalsBotSpender = { owner: Principal.fromText(PROPOSALS_BOT) };

    const approveGatePayment = (canisterId: string = GROUP.groupId) =>
        agent.approveAccessGatePayment(canisterId, ICP_LEDGER, GATE_APPROVAL, FIVE_MINUTES, "1234");

    const approveProposalFee = () =>
        agent.approveTransfer(PROPOSALS_BOT, ICP_LEDGER, 100n, FIVE_MINUTES, "1234");

    const submitProposal = (userId: string) =>
        agent.submitProposal(
            userId,
            "rrkah-fqaaa-aaaaa-aaaaq-cai",
            { title: "title", url: undefined, summary: "summary", action: { kind: "motion" } },
            ICP_LEDGER,
            "ICP",
            1_000n,
            FEE,
        );

    beforeEach(() => {
        approvals = [];
        approveResponse = "success";
        userCanisterApprovals = [];
        submitted = [];
    });

    describe("by a user in a MultiUser canister", () => {
        beforeEach(() => setup(MULTI_USER_CANISTER_USER));

        test.each([
            ["group", GROUP.groupId],
            ["community", CHANNEL.communityId],
        ])(
            "a %s is approved on the ledger to pull a gate's payment from their wallet as their member spender, for as long as asked",
            async (_, canisterId) => {
                expect(await approveGatePayment(canisterId)).toEqual({ kind: "success" });

                // The wallet pays the approval's fee on top
                expect(approvals).toEqual([
                    [
                        ICP_LEDGER,
                        memberSpender(canisterId),
                        GATE_APPROVAL,
                        FEE,
                        Number(FIVE_MINUTES),
                    ],
                ]);
                expect(userCanisterApprovals).toEqual([]);
            },
        );

        test("the ProposalsBot is approved on the ledger to pull a proposal's fee as its own account", async () => {
            expect(await approveProposalFee()).toEqual({ kind: "success" });

            expect(approvals).toEqual([
                [ICP_LEDGER, proposalsBotSpender, 100n, FEE, Number(FIVE_MINUTES)],
            ]);
            expect(userCanisterApprovals).toEqual([]);
        });

        test("with no expiry, the approval lasts only as long as a payment pulled at once needs", async () => {
            await agent.approveTransfer(PROPOSALS_BOT, ICP_LEDGER, 100n, undefined, undefined);

            expect(approvals).toEqual([
                [ICP_LEDGER, proposalsBotSpender, 100n, FEE, APPROVAL_VALIDITY_MS],
            ]);
        });

        test.each([
            ["insufficient_funds", ErrorCode.InsufficientFunds],
            ["failure", ErrorCode.ApprovalFailed],
        ] as const)("an approval which fails with %s is reported", async (response, code) => {
            approveResponse = response;

            expect(await approveGatePayment()).toEqual({ kind: "error", code, message: undefined });
        });

        test("nothing is approved while the ledger's fee isn't known", async () => {
            agent._registryValue = undefined;

            expect(await approveGatePayment()).toEqual({
                kind: "error",
                code: ErrorCode.ApprovalFailed,
                message: undefined,
            });
            expect(approvals).toEqual([]);
            expect(userCanisterApprovals).toEqual([]);
        });

        test("a proposal's fee is pulled from their wallet", async () => {
            await submitProposal(MULTI_USER_CANISTER_USER);

            expect(submitted.length).toEqual(1);
            expect(submitted[0][0]).toEqual(ME.toText());
        });
    });

    describe("by a user alone in their canister", () => {
        beforeEach(() => setup(USER_CANISTER_USER));

        test.each([
            ["group", GROUP.groupId],
            ["community", CHANNEL.communityId],
        ])(
            "their canister approves a %s to pull a gate's payment as their member spender, checking their PIN",
            async (_, canisterId) => {
                expect(await approveGatePayment(canisterId)).toEqual({ kind: "success" });

                expect(userCanisterApprovals).toEqual([
                    [memberSpender(canisterId), ICP_LEDGER, GATE_APPROVAL, FIVE_MINUTES, "1234"],
                ]);
                expect(approvals).toEqual([]);
            },
        );

        test("their canister approves the ProposalsBot to pull a proposal's fee as its own account, checking their PIN", async () => {
            expect(await approveProposalFee()).toEqual({ kind: "success" });

            expect(userCanisterApprovals).toEqual([
                [proposalsBotSpender, ICP_LEDGER, 100n, FIVE_MINUTES, "1234"],
            ]);
            expect(approvals).toEqual([]);
        });

        test("a proposal's fee is pulled from their canister's account", async () => {
            await submitProposal(USER_CANISTER_USER);

            expect(submitted.length).toEqual(1);
            expect(submitted[0][0]).toEqual(USER_CANISTER_USER);
        });
    });
});
