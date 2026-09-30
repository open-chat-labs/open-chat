import { Principal } from "@icp-sdk/core/principal";
import {
    APPROVAL_VALIDITY_MS,
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
    type PrizeContentInitial,
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

    const approveGatePayment = () =>
        agent.approveTransfer(GROUP.groupId, ICP_LEDGER, GATE_APPROVAL, FIVE_MINUTES, "1234");

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

        test("the spender is approved on the ledger to pull from their wallet, for as long as asked", async () => {
            expect(await approveGatePayment()).toEqual({ kind: "success" });

            // The spender's own account, since a group, community or the ProposalsBot pulls from a
            // user's wallet as itself. The wallet pays the approval's fee on top.
            expect(approvals).toEqual([
                [
                    ICP_LEDGER,
                    { owner: Principal.fromText(GROUP.groupId) },
                    GATE_APPROVAL,
                    FEE,
                    Number(FIVE_MINUTES),
                ],
            ]);
            expect(userCanisterApprovals).toEqual([]);
        });

        test("with no expiry, the approval lasts only as long as a payment pulled at once needs", async () => {
            await agent.approveTransfer(PROPOSALS_BOT, ICP_LEDGER, 100n, undefined, undefined);

            expect(approvals).toEqual([
                [
                    ICP_LEDGER,
                    { owner: Principal.fromText(PROPOSALS_BOT) },
                    100n,
                    FEE,
                    APPROVAL_VALIDITY_MS,
                ],
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

        test("their canister approves the spender, checking their PIN", async () => {
            expect(await approveGatePayment()).toEqual({ kind: "success" });

            expect(userCanisterApprovals).toEqual([
                [GROUP.groupId, ICP_LEDGER, GATE_APPROVAL, FIVE_MINUTES, "1234"],
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
