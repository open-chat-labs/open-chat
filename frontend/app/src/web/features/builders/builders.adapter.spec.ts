import {
    newPollContent,
    validateTokenInput,
    type CryptocurrencyContent,
    type EnhancedTokenDetails,
    type UserSummary,
} from "@client";
import type { PollDraft } from "@openchat/ui/src/features/components/PollBuilderDialog.svelte";
import {
    builderTokens,
    composerTransfer,
    newPoll,
    typedAmount,
    type Translate,
} from "./builders.adapter";

const icp = {
    name: "Internet Computer",
    symbol: "ICP",
    ledger: "icp-ledger",
    decimals: 8,
    transferFee: 10_000n,
    balance: 250_000_000n,
} as EnhancedTokenDetails;
const chat = { ...icp, name: "OpenChat", symbol: "CHAT", ledger: "chat-ledger", balance: 0n };
const rates = new Map([["icp-ledger", { toUSD: 5 }]]);

// the library's copy as its keys and values, so what's built can be checked
const t: Translate = (key, values) => `${key}${JSON.stringify(values ?? {})}`;

describe("the tokens a payment builder offers", () => {
    test("start from the one last sent, then the wallet's order", () => {
        const tokens = builderTokens([icp, chat], rates, "chat-ledger");
        expect(tokens.map((t) => t.ledger)).toEqual(["chat-ledger", "icp-ledger"]);
        expect(builderTokens([icp, chat], rates, undefined)[0].ledger).toBe("icp-ledger");
    });

    test("cost the transfer's fee and its approval's, and at least 10 transfer fees", () => {
        const [{ token }] = builderTokens([icp], rates, undefined);
        expect(token).toMatchObject({ symbol: "ICP", bal: 2.5, fee: 0.0002, min: 0.001, usd: 5 });
    });

    // the library tells tokens apart by their symbol
    test("are one per symbol", () => {
        const twin = { ...icp, ledger: "other-ledger" };
        expect(builderTokens([icp, twin], rates, "other-ledger").map((t) => t.ledger)).toEqual([
            "other-ledger",
        ]);
    });
});

describe("a staged transfer", () => {
    const bob = { userId: "bob", username: "bob", displayName: "Bob" } as UserSummary;
    const content: CryptocurrencyContent = {
        kind: "crypto_content",
        transfer: {
            kind: "pending",
            ledger: "icp-ledger",
            token: "ICP",
            recipient: "bob",
            amountE8s: 29_000_000n,
            feeE8s: 10_000n,
            createdAtNanos: 0n,
        },
    };

    test("shows its amount, who it's to, its value and what it costs with the fees", () => {
        expect(composerTransfer(content, icp, 5, bob, t)).toMatchObject({
            type: "transfer",
            amountText: "0.29 ICP",
            recipient: { id: "bob", name: "Bob", handle: "@bob" },
            usd: 1.45,
            feeText: "0.0002 ICP",
            totalText: "0.2902 ICP",
            summary: 'ui.sendCryptoDialog.summary{"handle":"@bob","usd":"$1.45"}',
        });
    });

    // 5d invariant 3: edited again, the amount reads back exactly
    test("is edited from the amount it holds, in full", () => {
        const edited = composerTransfer(content, icp, undefined, bob, t);
        expect(edited?.draft).toEqual({ tok: "ICP", amt: "0.29", to: "bob" });
        const amt = edited?.draft.amt ?? "";
        expect(validateTokenInput(amt, 8).amount).toBe(29_000_000n);
        expect(typedAmount(123_456_789_123n, 8)).toBe("1234.56789123");
    });
});

describe("a poll from the builder", () => {
    const draft: PollDraft = {
        question: "Lunch?",
        options: [
            { label: "Pizza", votes: 0 },
            { label: "Tacos", votes: 0 },
        ],
        multiple: false,
        publicVotes: false,
        canChange: true,
        hideResults: false,
        durationMs: 86_400_000,
        endsIn: "1 day",
        endsAt: 0,
    };

    test("keeps its question, answers and how long it runs", () => {
        expect(newPoll(draft)).toEqual({
            question: "Lunch?",
            answers: ["Pizza", "Tacos"],
            anonymous: true,
            showVotesBeforeEndDate: true,
            allowMultipleVotesPerUser: false,
            allowUserToChangeVote: true,
            durationMs: 86_400_000,
        });
    });

    // 5d invariant 6, through the builder's settings
    test("a poll's vote kind follows its settings: anonymous, visible, or hidden until it ends", () => {
        const kind = (d: Partial<PollDraft>) =>
            newPollContent(newPoll({ ...draft, ...d }), 0).votes.total.kind;
        expect(kind({})).toBe("anonymous_poll_votes");
        expect(kind({ publicVotes: true })).toBe("visible_poll_votes");
        expect(kind({ publicVotes: true, hideResults: true })).toBe("hidden_poll_votes");
    });

    test("is stamped to end when it's published", () => {
        expect(newPollContent(newPoll(draft), 5000).config.endDate).toBe(86_405_000n);
    });

    test("locked votes stay locked only for a single-choice poll", () => {
        const config = (d: Partial<PollDraft>) =>
            newPollContent(newPoll({ ...draft, ...d }), 0).config;
        expect(config({ canChange: false }).allowUserToChangeVote).toBe(false);
        expect(config({ canChange: false, multiple: true }).allowUserToChangeVote).toBe(true);
    });
});
