import { Principal } from "@icp-sdk/core/principal";
import {
    APPROVAL_VALIDITY_MS,
    ErrorCode,
    indexedUserId,
    LEDGER_CANISTER_CHAT,
    spenderSubaccount,
    Stream,
    type CryptocurrencyContent,
    type CryptocurrencyDetails,
    type DexSwapResult,
    type EventWrapper,
    type Message,
    type MessageContent,
    type P2PSwapContentInitial,
    type PendingCryptocurrencyTransfer,
    type PendingCryptocurrencyWithdrawal,
    type PrizeContentInitial,
    type TokenInfo,
    type UnfinishedTokenSwap,
} from "@shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AsyncMessageContextMap } from "../utils/messageContext";
import { OpenChatAgent } from "./openchatAgent";

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
// The device's clock while a payment is made, which is also the time on the IC unless a test says
// otherwise, so a payment is stamped with it
const NOW_MS = 1_791_565_000_000;
const NOW_NANOS = BigInt(NOW_MS) * 1_000_000n;
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
        createdAtNanos: NOW_NANOS,
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

const PIN_INCORRECT = { kind: "error", code: ErrorCode.PinIncorrect, message: "0" } as const;

// The payments the user's canister pulls from the user's wallet, each of which a user in a
// MultiUser canister has to approve it for first
describe("OpenChatAgent paying from the user's wallet", () => {
    let approvals: unknown[][];
    let approveResponse: "success" | "insufficient_funds" | "failure";
    // Each PIN checked, with how many approvals had been made by then
    let pinChecks: [string, number][];
    let pinCheckResponse: "success" | "incorrect";
    let calls: string[];
    let callArgs: unknown[][];
    // How far the IC's clock is ahead of the device's, and each ledger whose subnet it was read from
    let timeDiffMsecs: number;
    let syncedWith: string[];
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
        agent._agent = {
            syncTime: (canisterId: Principal) => {
                syncedWith.push(canisterId.toText());
                return Promise.resolve();
            },
            getTimeDiffMsecs: () => timeDiffMsecs,
        };
        agent._registryValue = {
            tokenDetails: [
                { ledger: ICP_LEDGER, transferFee: FEE },
                { ledger: LEDGER_CANISTER_CHAT, transferFee: CHAT_FEE },
            ],
        };
        agent._ledgerClient = {
            approveSpending: (...args: unknown[]) => {
                approvals.push(args);
                return Promise.resolve(approveResponse);
            },
        };
        agent._userClient = {
            userId,
            checkPinNumber: (pin: string) => {
                pinChecks.push([pin, approvals.length]);
                switch (pinCheckResponse) {
                    case "success":
                        return Promise.resolve({ kind: "success" });
                    case "incorrect":
                        return Promise.resolve(PIN_INCORRECT);
                }
            },
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
        agent._proposalsBotClient = { get: () => ({ submitProposal: called("submitProposal") }) };
    }

    // Sends a message to a group or channel, giving the response once it is final
    const send = (
        chatId: typeof DIRECT | typeof GROUP | typeof CHANNEL,
        content: MessageContent,
        threadRootMessageIndex?: number,
        acceptedRules?: { chat: number; community: number },
        pin?: string,
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
                    pin,
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

    const sendDirectMessage = (content: MessageContent, pin?: string) =>
        agent.sendDirectMessage(DIRECT, message(content), undefined, undefined, pin, () => {});

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

    // Every payment made with a PIN, and whether the PIN is passed on to the canister which pulls
    // the payment, so that it checks it again. A group or community has no way to check it.
    const paymentsWithPin: [string, (pin: string) => Promise<unknown>, boolean][] = [
        ["crypto sent in a direct chat", (pin) => sendDirectMessage(crypto(), pin), true],
        ["swap offered in a direct chat", (pin) => sendDirectMessage(swapOffer(), pin), true],
        [
            "tip in a direct chat",
            (pin) => agent.tipMessage({ chatId: DIRECT }, 1n, transfer(), 8, pin),
            true,
        ],
        [
            "swap accepted in a group",
            (pin) => agent.acceptP2PSwap(GROUP, undefined, 1n, ICP, 100n, pin, false, undefined),
            true,
        ],
        ["streak insurance", (pin) => agent.payForStreakInsurance(1, 5_000n, pin), true],
        [
            "Diamond membership",
            (pin) =>
                agent.payForDiamondMembership(
                    "",
                    ICP_LEDGER,
                    "one_month",
                    false,
                    100n,
                    undefined,
                    pin,
                ),
            false,
        ],
        ...transferMessages.flatMap(([what, content]) =>
            (
                [
                    ["a group", GROUP],
                    ["a channel", CHANNEL],
                ] as const
            ).map(([where, chatId]): (typeof paymentsWithPin)[number] => [
                `${what} sent in ${where}`,
                (pin) => send(chatId, content(), undefined, undefined, pin),
                false,
            ]),
        ),
        ...(
            [
                ["a group", GROUP],
                ["a channel", CHANNEL],
            ] as const
        ).map(([where, chatId]): (typeof paymentsWithPin)[number] => [
            `tip in ${where}`,
            (pin) => agent.tipMessage({ chatId }, 1n, transfer(), 8, pin, "me", undefined, true),
            false,
        ]),
    ];

    beforeEach(() => {
        approvals = [];
        approveResponse = "success";
        pinChecks = [];
        pinCheckResponse = "success";
        calls = [];
        callArgs = [];
        timeDiffMsecs = 0;
        syncedWith = [];
        vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => vi.restoreAllMocks());

    describe("by a user in a MultiUser canister", () => {
        beforeEach(() => setup(MULTI_USER_CANISTER_USER));

        const spender = { owner: MULTI_USER_CANISTER, subaccount: spenderSubaccount(ME) };

        test.each(payments)("%s is approved first", async (_, pay, ledger, amount) => {
            await pay();

            expect(approvals).toEqual([[ledger, spender, amount, FEE, APPROVAL_VALIDITY_MS]]);
            expect(calls.length).toEqual(1);
            expect(pinChecks).toEqual([]);
        });

        test.each(paymentsWithPin)(
            "%s has its PIN checked before it is approved",
            async (_, pay, passedOn) => {
                await pay("1234");

                expect(pinChecks).toEqual([["1234", 0]]);
                expect(approvals.length).toEqual(1);
                expect(calls.length).toEqual(1);
                if (passedOn) {
                    expect(callArgs[0]).toContain("1234");
                }
            },
        );

        test("a payment is neither approved nor made with the wrong PIN", async () => {
            pinCheckResponse = "incorrect";

            const response = await sendDirectMessage(crypto(), "0000");

            expect([response].flat()[0]).toEqual(PIN_INCORRECT);
            expect(approvals).toEqual([]);
            expect(calls).toEqual([]);
        });

        test("nothing has its PIN checked while the ledger's fee isn't known", async () => {
            agent._registryValue = undefined;

            await agent.payForDiamondMembership(
                "",
                ICP_LEDGER,
                "one_month",
                false,
                100n,
                undefined,
                "1234",
            );

            expect(pinChecks).toEqual([]);
            expect(approvals).toEqual([]);
        });

        test("a payment from another account has no PIN checked, since it isn't approved", async () => {
            await agent.tipMessage({ chatId: DIRECT }, 1n, transfer(EXTERNAL_ACCOUNT), 8, "1234");

            expect(pinChecks).toEqual([]);
            expect(calls).toEqual(["tipMessage"]);
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

        test("a payment has no PIN checked first, since nothing is approved", async () => {
            await sendDirectMessage(crypto(), "1234");

            expect(pinChecks).toEqual([]);
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

    // A ledger rejects a transfer created more than a minute in its future, which each transfer
    // stamped by a device whose clock is fast would be
    describe("from a device whose clock is ahead of the IC's", () => {
        const AHEAD_MS = 160_000;
        const icNow = BigInt(NOW_MS - AHEAD_MS) * 1_000_000n;

        // The stamp on the transfer in the message sent
        const stampSent = () => {
            const event = callArgs[0].find(
                (arg) => (arg as EventWrapper<Message> | undefined)?.event?.content !== undefined,
            ) as EventWrapper<Message>;
            return (event.event.content as { transfer: PendingCryptocurrencyTransfer }).transfer
                .createdAtNanos;
        };

        beforeEach(() => {
            timeDiffMsecs = -AHEAD_MS;
        });

        test.each([
            ["crypto in a direct chat", MULTI_USER_CANISTER_USER, DIRECT, crypto],
            ["crypto in a group", MULTI_USER_CANISTER_USER, GROUP, crypto],
            ["a prize in a channel", MULTI_USER_CANISTER_USER, CHANNEL, prize],
            [
                "crypto in a group, by a user alone in their canister",
                USER_CANISTER_USER,
                GROUP,
                crypto,
            ],
        ] as const)(
            "%s is stamped with the time on the ledger's subnet",
            async (_, userId, chatId, content) => {
                setup(userId);

                await send(chatId, content());

                expect(stampSent()).toEqual(icNow);
                expect(syncedWith).toEqual([ICP_LEDGER]);
            },
        );

        test.each([
            ["group", GROUP, "groupTipMessage"],
            ["channel", CHANNEL, "communityTipMessage"],
        ] as const)(
            "a tip in a %s, pulled from the wallet by it, is stamped with the time on the ledger's subnet",
            async (_, chatId, call) => {
                setup(MULTI_USER_CANISTER_USER);

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

                expect(calls).toEqual([call]);
                expect((callArgs[0][3] as PendingCryptocurrencyTransfer).createdAtNanos).toEqual(
                    icNow,
                );
                expect(syncedWith).toEqual([ICP_LEDGER]);
            },
        );

        test.each([
            ["a user in a MultiUser canister", MULTI_USER_CANISTER_USER],
            ["a user alone in their canister", USER_CANISTER_USER],
        ])(
            "the fee for a proposal by %s is stamped with the time on the ledger's subnet",
            async (_, userId) => {
                setup(userId);

                await agent.submitProposal(userId, "", {}, ICP_LEDGER, "ICP", 100n, FEE);

                expect(calls).toEqual(["submitProposal"]);
                expect(callArgs[0].at(-1)).toEqual(icNow);
                expect(syncedWith).toEqual([ICP_LEDGER]);
            },
        );

        test("a swap offer has nothing to stamp, so the IC isn't asked the time", async () => {
            setup(MULTI_USER_CANISTER_USER);

            await send(GROUP, swapOffer());

            expect(calls).toEqual(["groupSendMessage"]);
            expect(syncedWith).toEqual([]);
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
        createdAtNanos: NOW_NANOS,
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
    // How far the IC's clock is ahead of the device's, and each ledger whose subnet it was read from
    let timeDiffMsecs: number;
    let syncedWith: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function setup(userId: string) {
        ledgerWithdrawals = [];
        canisterWithdrawals = [];
        timeDiffMsecs = 0;
        syncedWith = [];
        vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
        agent = Object.create(OpenChatAgent.prototype);
        agent.identity = { getPrincipal: () => ME };
        agent._agent = {
            syncTime: (canisterId: Principal) => {
                syncedWith.push(canisterId.toText());
                return Promise.resolve();
            },
            getTimeDiffMsecs: () => timeDiffMsecs,
        };
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

    afterEach(() => vi.restoreAllMocks());

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

    // Whether the ledger is called by the website or by their canister, it rejects a withdrawal
    // created more than a minute in its future
    test.each([
        ["a user in a MultiUser canister", MULTI_USER_CANISTER_USER, () => ledgerWithdrawals],
        ["a user alone in their canister", USER_CANISTER_USER, () => canisterWithdrawals],
    ])(
        "a withdrawal by %s from a device whose clock is fast is stamped with the time on the ledger's subnet",
        async (_, userId, withdrawals) => {
            setup(userId);
            timeDiffMsecs = -160_000;

            await agent.withdrawCryptocurrency(WITHDRAWAL, PIN);

            expect(withdrawals()[0][0]).toEqual({
                ...WITHDRAWAL,
                createdAtNanos: BigInt(NOW_MS - 160_000) * 1_000_000n,
            });
            expect(syncedWith).toEqual([ICP_LEDGER]);
        },
    );
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

    // Rather than find nothing, which would look like a check which found the wallets empty
    test("rejects if the previous wallets can't be checked before the Registry has loaded", async () => {
        agent._registryValue = undefined;

        await expect(agent.fundsInPreviousWallets([PREVIOUS])).rejects.toThrow(
            "The Registry hasn't loaded",
        );
        expect(balanceOwners.size).toBe(0);
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
        const notAuthorized = {
            kind: "error",
            code: ErrorCode.InitiatorNotAuthorized,
            message: "Caller wasn't migrated from the old user id",
        };
        moveResponse = (localUserIndex) =>
            localUserIndex === LOCAL_USER_INDEX ? notAuthorized : CANISTER_NOT_FOUND;

        expect(await agent.moveFundsFromPreviousWallets(funds(PREVIOUS, [ICP_LEDGER]))).toEqual([
            {
                previousUserId: PREVIOUS,
                ledger: ICP_LEDGER,
                result: { kind: "failed", error: notAuthorized },
            },
        ]);
        expect(moves).toHaveLength(2);
    });

    // As it is while the LocalUserIndex refunds its cycles, which it does after each batch
    test("a move turned away while the canister is busy is retried, up to 3 times", async () => {
        const inProgress = {
            kind: "error",
            code: ErrorCode.AlreadyInProgress,
            message: "Old canister's cycles being refunded",
        };
        let busyFor = 0;
        moveResponse = (localUserIndex, ledgers) => {
            if (localUserIndex !== LOCAL_USER_INDEX) return CANISTER_NOT_FOUND;
            if (busyFor-- > 0) return inProgress;
            return { kind: "success", outcomes: ledgers.map((ledger) => moved(ledger)) };
        };
        const move = async () => {
            moves = [];
            const outcomes = agent.moveFundsFromPreviousWallets(
                funds(OTHER_PREVIOUS, [ICP_LEDGER]),
            );
            await vi.runAllTimersAsync();
            return outcomes;
        };

        vi.useFakeTimers();
        try {
            busyFor = 3;
            expect(await move()).toEqual([
                { previousUserId: OTHER_PREVIOUS, ...moved(ICP_LEDGER) },
            ]);
            expect(moves).toHaveLength(4);

            busyFor = 4;
            expect(await move()).toEqual([
                {
                    previousUserId: OTHER_PREVIOUS,
                    ledger: ICP_LEDGER,
                    result: { kind: "failed", error: inProgress },
                },
            ]);
            expect(moves).toHaveLength(4);
        } finally {
            vi.useRealTimers();
        }
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

    test("a controller which rejects the call is passed over", async () => {
        moveResponse = (localUserIndex, ledgers) => {
            if (localUserIndex !== LOCAL_USER_INDEX) {
                throw new Error("Canister has no update method 'move_funds_from_old_canister'");
            }
            return { kind: "success", outcomes: ledgers.map((ledger) => moved(ledger)) };
        };

        expect(await agent.moveFundsFromPreviousWallets(funds(PREVIOUS, [ICP_LEDGER]))).toEqual([
            { previousUserId: PREVIOUS, ...moved(ICP_LEDGER) },
        ]);
        expect(moves.map(([localUserIndex]) => localUserIndex)).toEqual([
            OTHER_LOCAL_USER_INDEX,
            LOCAL_USER_INDEX,
        ]);
    });

    // `CanisterStatus` gives null, rather than throwing, for controllers it couldn't read
    test("each ledger fails if the previous canister's controllers can't be read", async () => {
        delete agent.canisterControllers;
        const fetchRootKey = vi.fn(() => {
            agent._agent.rootKey = new Uint8Array();
            return Promise.resolve(agent._agent.rootKey);
        });
        agent._agent = {
            rootKey: null,
            fetchRootKey,
            readState: () => Promise.reject(new Error("Failed to fetch")),
        };

        expect(await agent.moveFundsFromPreviousWallets(funds(PREVIOUS, [ICP_LEDGER]))).toEqual([
            {
                previousUserId: PREVIOUS,
                ledger: ICP_LEDGER,
                result: {
                    kind: "failed",
                    error: {
                        kind: "error",
                        code: ErrorCode.Unknown,
                        message: `Error: Unable to read the controllers of ${PREVIOUS}`,
                    },
                },
            },
        ]);
        expect(fetchRootKey).toHaveBeenCalledOnce();
        expect(moves).toEqual([]);
    });

    test("one previous canister failing doesn't stop the others being moved from", async () => {
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
    let pinChecks: [string, number][];
    let pinCheckResponse: "success" | "incorrect";
    let userCanisterApprovals: unknown[][];
    let submitted: unknown[][];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function setup(userId: string) {
        agent = Object.create(OpenChatAgent.prototype);
        agent.identity = { getPrincipal: () => ME };
        agent._registryValue = { tokenDetails: [{ ledger: ICP_LEDGER, transferFee: FEE }] };
        agent._agent = { syncTime: () => Promise.resolve(), getTimeDiffMsecs: () => 0 };
        agent._ledgerClient = {
            approveSpending: (...args: unknown[]) => {
                approvals.push(args);
                return Promise.resolve("success");
            },
        };
        agent._userClient = {
            userId,
            checkPinNumber: (pin: string) => {
                pinChecks.push([pin, approvals.length]);
                return Promise.resolve(
                    pinCheckResponse === "success" ? { kind: "success" } : PIN_INCORRECT,
                );
            },
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
        pinChecks = [];
        pinCheckResponse = "success";
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

        test.each([
            ["a gate's payment", approveGatePayment],
            ["a proposal's fee", approveProposalFee],
        ])("%s has its PIN checked by their canister first", async (_, approve) => {
            await approve();

            expect(pinChecks).toEqual([["1234", 0]]);
            expect(approvals.length).toEqual(1);
        });

        test("a gate's payment isn't approved with the wrong PIN", async () => {
            pinCheckResponse = "incorrect";

            expect(await approveGatePayment()).toEqual(PIN_INCORRECT);
            expect(approvals).toEqual([]);
        });

        test("with no expiry, the approval lasts only as long as a payment pulled at once needs", async () => {
            await agent.approveTransfer(PROPOSALS_BOT, ICP_LEDGER, 100n, undefined, undefined);

            expect(approvals).toEqual([
                [ICP_LEDGER, proposalsBotSpender, 100n, FEE, APPROVAL_VALIDITY_MS],
            ]);
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
                expect(pinChecks).toEqual([]);
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

// A user migrated to a MultiUser canister held their funds in their User canister's account until
// then, and in their principal's account since, so their history is that of both
describe("OpenChatAgent listing the transactions of each of the user's wallets", () => {
    const PREVIOUS = USER_CANISTER_USER;
    const CURRENT = MULTI_USER_CANISTER_USER;
    const LEDGER_INDEX = "qhbym-qaaaa-aaaaa-aaafq-cai";

    // The wallets fetched, by their owner, and the user each was named as being
    let fetched: { owner: string; userId: string }[];

    // An agent whose session is under `sessionUserId`, with the user's other ids mapped as given,
    // and whose ledger index holds `history`, by wallet owner, of transaction ids
    function setup(
        sessionUserId: string,
        ownLatestUserIds: [string, string][],
        history: Record<string, bigint[]> = {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): any {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agent = Object.create(OpenChatAgent.prototype) as any;
        agent.identity = { getPrincipal: () => ME };
        agent._userClient = { userId: sessionUserId };
        agent._ownLatestUserIds = new Map(ownLatestUserIds);
        agent._ledgerIndexClient = {
            getAccountTransactions: (
                _ledgerIndex: string,
                account: { owner: Principal },
                wallets: { userId: string },
            ) => {
                const owner = account.owner.toText();
                fetched.push({ owner, userId: wallets.userId });
                const ids = history[owner] ?? [];
                return Promise.resolve({
                    kind: "success",
                    transactions: ids.map((id) => ({ id, kind: "mint", timestamp: new Date(0) })),
                    oldestTransactionId: ids.length > 0 ? ids[ids.length - 1] : undefined,
                });
            },
        };
        fetched = [];
        return agent;
    }

    test("a migrated user's history is that of their principal's wallet and their User canister's", async () => {
        const agent = setup(CURRENT, [[PREVIOUS, CURRENT]], {
            [ME.toText()]: [9n, 4n],
            [PREVIOUS]: [7n, 4n, 2n],
        });

        const result = await agent.getAccountTransactions(LEDGER_INDEX, CURRENT);

        expect(fetched).toEqual([
            { owner: ME.toText(), userId: CURRENT },
            { owner: PREVIOUS, userId: CURRENT },
        ]);
        expect(result.transactions.map((t: { id: bigint }) => t.id)).toEqual([9n, 7n, 4n, 2n]);
        expect(result.oldestTransactionId).toBe(2n);
    });

    test("an earlier id in a MultiUser canister shares the principal's wallet, fetched once", async () => {
        const agent = setup(CURRENT, [[OTHER_MULTI_USER_CANISTER_USER, CURRENT]]);

        await agent.getAccountTransactions(LEDGER_INDEX, CURRENT);

        expect(fetched).toEqual([{ owner: ME.toText(), userId: CURRENT }]);
    });

    test("a session under the earlier id lists the latest id's wallet too", async () => {
        const agent = setup(PREVIOUS, [[CURRENT, PREVIOUS]]);

        await agent.getAccountTransactions(LEDGER_INDEX, PREVIOUS);

        expect(fetched).toEqual([
            { owner: PREVIOUS, userId: PREVIOUS },
            { owner: ME.toText(), userId: PREVIOUS },
        ]);
    });

    test("ids which aren't mapped onto the session's add no wallets", async () => {
        // eg. a new account on the same principal as a deleted one
        const agent = setup(CURRENT, [[PREVIOUS, THEM]]);

        await agent.getAccountTransactions(LEDGER_INDEX, CURRENT);

        expect(fetched).toEqual([{ owner: ME.toText(), userId: CURRENT }]);
    });
});

// A user in a MultiUser canister holds their own funds, so swaps straight from their wallet, which
// their canister only records as the swap starts and ends
describe("OpenChatAgent swapping tokens", () => {
    const POOL = "ne2vj-6yaaa-aaaag-qb3ia-cai";
    const ICP_DETAILS = {
        ledger: ICP_LEDGER,
        symbol: "ICP",
        decimals: 8,
        transferFee: FEE,
    } as CryptocurrencyDetails;
    const CHAT_DETAILS = {
        ledger: LEDGER_CANISTER_CHAT,
        symbol: "CHAT",
        decimals: 8,
        transferFee: CHAT_FEE,
    } as CryptocurrencyDetails;

    let calls: unknown[][];
    let approveResponse: "success" | "insufficient_funds" | "failure";
    let swapResult: () => Promise<DexSwapResult>;
    let unusedBalances:
        | { ledger: string; balance: bigint }[]
        | (() => { ledger: string; balance: bigint }[]);
    let withdrawSucceeds: boolean;
    let unfinishedSwaps: UnfinishedTokenSwap[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function setup(userId: string) {
        const called =
            (name: string, response: unknown = { kind: "success" }) =>
            (...args: unknown[]) => {
                calls.push([name, ...args]);
                return Promise.resolve(response);
            };
        agent = Object.create(OpenChatAgent.prototype);
        agent.identity = { getPrincipal: () => ME };
        agent._registryValue = {
            tokenDetails: [
                { ledger: ICP_LEDGER, transferFee: FEE },
                { ledger: LEDGER_CANISTER_CHAT, transferFee: CHAT_FEE },
            ],
            swapProviders: ["icpswap", "taco"],
        };
        agent._dexesAgent = {
            get: () => ({
                getSwapPools: () =>
                    Promise.resolve([
                        {
                            dex: "icpswap",
                            canisterId: POOL,
                            token0: ICP_LEDGER,
                            token1: LEDGER_CANISTER_CHAT,
                        },
                    ]),
            }),
        };
        agent._ledgerClient = {
            approveSpending: (...args: unknown[]) => {
                calls.push(["approve", ...args]);
                return Promise.resolve(approveResponse);
            },
        };
        agent._userClient = {
            userId,
            swapTokens: called("canisterSwap", { kind: "success", amountOut: 1n }),
            markTokenSwapStarted: called("started"),
            markTokenSwapCompleted: called("completed"),
            unfinishedTokenSwaps: () => Promise.resolve(unfinishedSwaps),
        };
        agent.icpSwapPoolClient = (canisterId: string, token0: string, token1: string) => ({
            swapFromWallet: (...args: unknown[]) => {
                calls.push(["swap", canisterId, ...args]);
                return swapResult();
            },
            unusedBalances: (principal: Principal) => {
                calls.push(["unusedBalances", canisterId, token0, token1, principal]);
                return Promise.resolve(
                    typeof unusedBalances === "function" ? unusedBalances() : unusedBalances,
                );
            },
            withdraw: (...args: unknown[]) => {
                calls.push(["withdraw", canisterId, ...args]);
                return Promise.resolve(withdrawSucceeds);
            },
        });
    }

    beforeEach(() => {
        calls = [];
        approveResponse = "success";
        swapResult = () => Promise.resolve({ kind: "success", amountOut: 400n });
        unusedBalances = [];
        withdrawSucceeds = true;
        unfinishedSwaps = [];
        setup(MULTI_USER_CANISTER_USER);
    });

    // Swaps, giving how the swap ended along with the steps it reported along the way
    const swapWith = (amountIn: bigint, pin?: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Promise<{ response: any; steps: string[] }>((resolve, reject) => {
            const steps: string[] = [];
            agent
                .swapTokens(123n, ICP_DETAILS, CHAT_DETAILS, amountIn, 500n, "icpswap", pin)
                .subscribe({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onResult: (value: any, final: boolean) =>
                        final ? resolve({ response: value, steps }) : steps.push(value.step),
                    onError: reject,
                });
        });
    const swap = (pin?: string) => swapWith(1_000n, pin);

    const exchangeArgs = { dex: "icpswap", swapCanisterId: POOL, zeroForOne: true };

    test("records the swap, approves the pool, swaps, then records how it ended", async () => {
        const { response, steps } = await swap("1234");

        expect(response).toEqual({ kind: "success", amountOut: 400n });
        expect(steps).toEqual(["approve", "swap"]);
        // The PIN is checked as the swap is recorded, so not again for the approval. The
        // approval's fee and the pool's pull are taken out of the amount swapped, so the swap
        // takes 1_000 from the wallet in all. Once swapped, the pool is checked for having paid
        // out the output.
        expect(calls).toEqual([
            ["started", 123n, ICP_DETAILS, CHAT_DETAILS, 1_000n, 500n, exchangeArgs, "1234"],
            [
                "approve",
                ICP_LEDGER,
                { owner: Principal.fromText(POOL) },
                990n,
                FEE,
                APPROVAL_VALIDITY_MS,
            ],
            ["swap", POOL, ICP_LEDGER, LEDGER_CANISTER_CHAT, 980n, 500n, FEE, CHAT_FEE],
            ["completed", 123n, { kind: "swapped", amountOut: 400n }],
            ["unusedBalances", POOL, ICP_LEDGER, LEDGER_CANISTER_CHAT, ME],
        ]);
    });

    test("a swap the user's canister won't record, eg. for the wrong PIN, goes no further", async () => {
        agent._userClient.markTokenSwapStarted = (...args: unknown[]) => {
            calls.push(["started", ...args]);
            return Promise.resolve(PIN_INCORRECT);
        };

        expect(await swap("4321")).toEqual({ response: PIN_INCORRECT, steps: [] });
        expect(calls.map((c) => c[0])).toEqual(["started"]);
    });

    test("a swap the DEX refuses as the rate has moved is recorded as failed", async () => {
        const error =
            '{"InternalError":"Slippage check failed: minimum amount requirement not met"}';
        swapResult = () => Promise.resolve({ kind: "error", error });

        const { response } = await swap();
        expect(response).toEqual({ kind: "error", code: ErrorCode.SwapFailed, message: error });
        expect(calls.at(-1)).toEqual(["completed", 123n, { kind: "failed", reason: error }]);
    });

    test("a swap the DEX refuses for any other reason is recorded as failed", async () => {
        const error = '{"InternalError":"Wrong fee cache (expected: 20, received: 10)"}';
        swapResult = () => Promise.resolve({ kind: "error", error });

        expect((await swap()).response).toEqual({ kind: "internal_error", error });
        expect(calls.at(-1)).toEqual(["completed", 123n, { kind: "failed", reason: error }]);
    });

    test("recording how a swap ended is retried", async () => {
        let attempts = 0;
        agent._userClient.markTokenSwapCompleted = (...args: unknown[]) => {
            calls.push(["completed", ...args]);
            return ++attempts < 3
                ? Promise.reject(new Error("offline"))
                : Promise.resolve({ kind: "success" });
        };

        expect((await swap()).response).toEqual({ kind: "success", amountOut: 400n });
        expect(calls.filter((c) => c[0] === "completed")).toHaveLength(3);
    });

    test("a swap whose outcome is unknown is left unfinished", async () => {
        swapResult = () => Promise.reject(new Error("timed out"));

        const { response, steps } = await swap();
        expect(response.kind).toBe("error");
        expect(response.code).toBe(ErrorCode.Unknown);
        expect(steps).toEqual(["approve", "swap"]);
        expect(calls.map((c) => c[0])).toEqual(["started", "approve", "swap"]);
    });

    test("a swap whose pool can't be approved is recorded as failed", async () => {
        approveResponse = "insufficient_funds";

        const { response, steps } = await swap();
        expect(response.code).toBe(ErrorCode.InsufficientFunds);
        expect(steps).toEqual(["approve"]);
        expect(calls.map((c) => c[0])).toEqual(["started", "approve", "completed"]);
        expect(calls.at(-1)?.[2]).toMatchObject({ kind: "failed" });
    });

    test("too little to cover the fees is refused before anything is recorded", async () => {
        const { response } = await swapWith(3n * FEE);

        expect(response.code).toBe(ErrorCode.InsufficientFunds);
        expect(calls).toEqual([]);
    });

    test("doesn't withdraw what the pool pays out itself", async () => {
        let checks = 0;
        unusedBalances = () =>
            ++checks === 1 ? [{ ledger: LEDGER_CANISTER_CHAT, balance: 5_000n }] : [];

        vi.useFakeTimers();
        try {
            const swapped = swap();
            await vi.runAllTimersAsync();
            const { steps } = await swapped;

            expect(steps).toEqual(["approve", "swap"]);
            expect(calls.filter((c) => c[0] === "unusedBalances")).toHaveLength(2);
            expect(calls.some((c) => c[0] === "withdraw")).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    test("withdraws what the pool still holds once it has had time to pay out", async () => {
        unusedBalances = [{ ledger: LEDGER_CANISTER_CHAT, balance: 5_000n }];

        vi.useFakeTimers();
        try {
            const swapped = swap();
            await vi.runAllTimersAsync();
            const { response, steps } = await swapped;

            expect(response).toEqual({ kind: "success", amountOut: 400n });
            expect(steps).toEqual(["approve", "swap", "withdraw"]);
            expect(calls.at(-1)).toEqual([
                "withdraw",
                POOL,
                LEDGER_CANISTER_CHAT,
                5_000n,
                CHAT_FEE,
            ]);
        } finally {
            vi.useRealTimers();
        }
    });

    test("a user alone in their canister has their canister make the swap", async () => {
        setup(USER_CANISTER_USER);

        expect(await swap()).toEqual({ response: { kind: "success", amountOut: 1n }, steps: [] });
        expect(calls.map((c) => c[0])).toEqual(["canisterSwap"]);
    });

    test("only ICPSwap is offered to a user who holds their own funds", () => {
        expect(agent.swapProviders()).toEqual(["icpswap"]);
        setup(USER_CANISTER_USER);
        expect(agent.swapProviders()).toEqual(["icpswap", "taco"]);
    });

    describe("recovering unfinished swaps", () => {
        const unfinished = (swapId: bigint): UnfinishedTokenSwap => ({
            swapId,
            started: 0n,
            inputLedger: LEDGER_CANISTER_CHAT,
            outputLedger: ICP_LEDGER,
            exchangeArgs: { dex: "icpswap", swapCanisterId: POOL, zeroForOne: false },
        });

        test("withdraws what the pool holds for the user, then marks the swap completed", async () => {
            unfinishedSwaps = [unfinished(1n)];
            unusedBalances = [
                { ledger: ICP_LEDGER, balance: 500n },
                { ledger: LEDGER_CANISTER_CHAT, balance: CHAT_FEE },
            ];

            await agent.recoverUnfinishedTokenSwaps();

            // The pool's tokens are put back in its order, and a balance too small to cover the
            // fee is left where it is
            expect(calls).toEqual([
                ["unusedBalances", POOL, ICP_LEDGER, LEDGER_CANISTER_CHAT, ME],
                ["withdraw", POOL, ICP_LEDGER, 500n, FEE],
                [
                    "completed",
                    1n,
                    {
                        kind: "failed",
                        reason: "Never marked as completed, so how it ended isn't known",
                    },
                ],
            ]);
        });

        test("skips a zero balance, even of a token it doesn't know the fee of", async () => {
            unfinishedSwaps = [unfinished(1n)];
            unusedBalances = [{ ledger: THEM, balance: 0n }];

            await agent.recoverUnfinishedTokenSwaps();

            expect(calls.map((c) => c[0])).toEqual(["unusedBalances", "completed"]);
        });

        test("leaves a swap unfinished if its funds can't be withdrawn", async () => {
            unfinishedSwaps = [unfinished(1n)];
            unusedBalances = [{ ledger: ICP_LEDGER, balance: 500n }];
            withdrawSucceeds = false;

            await agent.recoverUnfinishedTokenSwaps();

            expect(calls.map((c) => c[0])).toEqual(["unusedBalances", "withdraw"]);
        });

        test("does nothing for a user alone in their canister", async () => {
            setup(USER_CANISTER_USER);
            unfinishedSwaps = [unfinished(1n)];

            await agent.recoverUnfinishedTokenSwaps();

            expect(calls).toEqual([]);
        });
    });
});
