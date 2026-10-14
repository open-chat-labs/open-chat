import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client builds at import time reads the screen width through
// matchMedia, which jsdom does not provide
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

// The constructor starts an auth client against IndexedDB; keep it inert
vi.mock("@icp-sdk/auth/client", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    AuthClient: { create: () => new Promise(() => {}) },
}));

import {
    anonymousUser,
    APPROVAL_VALIDITY_MS,
    type CandidateProposal,
    type NervousSystemDetails,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore, pinNumberRequiredStore, pinNumberResolverStore } from "./state";
import { nervousSystemLookup } from "./state/app/stores";
import { WorkerAgent } from "./workerAgent";

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

const PROPOSALS_BOT = "proposals-bot";
const REGISTRY = "registry";
const USER_INDEX = "user-index";
const GOVERNANCE = "governance";
const SNS_LEDGER = "sns-ledger";
const FEE = 100_000n;
const REJECTION_FEE = 400_000_000n;
const SEVEN_DAYS = BigInt(1000 * 60 * 60 * 24 * 7);

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: PROPOSALS_BOT,
        registryCanister: REGISTRY,
        userIndexCanister: USER_INDEX,
    } as unknown as OpenChatConfig;
}

const nervousSystem = {
    governanceCanisterId: GOVERNANCE,
    proposalRejectionFee: REJECTION_FEE,
    // Not CHAT's ledger, so a check sees the approvals are made on the SNS's own ledger
    token: { ledger: SNS_LEDGER, symbol: "SNS", transferFee: FEE, decimals: 8 },
} as unknown as NervousSystemDetails;

const proposal: CandidateProposal = {
    title: "Title",
    url: undefined,
    summary: "Summary",
    action: { kind: "motion" },
};

describe("making a proposal", () => {
    let client: OpenChat;
    let sent: WorkerRequest[];
    let approved: boolean;

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        nervousSystemLookup.set(new Map([[GOVERNANCE, nervousSystem]]));
        client = new OpenChat(config());
        sent = [];
        approved = true;
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            sent.push(req);
            switch (req.kind) {
                case "approveTransfer":
                    return Promise.resolve(
                        approved
                            ? { kind: "success" }
                            : { kind: "error", code: 0, message: undefined },
                    );
                case "submitProposal":
                    return Promise.resolve({ kind: "success" });
                default:
                    return new Promise(() => {});
            }
        }) as never);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        nervousSystemLookup.set(new Map());
        pinNumberRequiredStore.set(undefined);
    });

    function approvals() {
        return sent
            .filter((r) => r.kind === "approveTransfer")
            .map((r) => ({
                ledger: r.ledger,
                spender: r.spender,
                amount: r.amount,
                expiresIn: r.expiresIn,
            }));
    }

    function submissions() {
        return sent.filter((r) => r.kind === "submitProposal");
    }

    // Invariant: the ProposalsBot is approved to take exactly the proposal's fee, on the SNS's ledger,
    // for as long as it takes to submit, and nothing else is approved for a proposal with no execution payment
    test("a proposal approves its fee to the ProposalsBot and is submitted", async () => {
        expect(await client.makeProposal(GOVERNANCE, proposal)).toEqual({ kind: "submitted" });

        expect(approvals()).toEqual([
            {
                ledger: SNS_LEDGER,
                spender: PROPOSALS_BOT,
                amount: REJECTION_FEE + 2n * FEE,
                expiresIn: BigInt(APPROVAL_VALIDITY_MS),
            },
        ]);
        expect(submissions()).toEqual([expect.objectContaining({ proposal })]);
    });

    // Invariant: the payment a proposal's execution takes is approved, in full, to the canister that
    // takes it, for long enough to last the vote
    test("a token listing and an achievement approve their payment to the canister that takes it", async () => {
        await client.makeProposal(GOVERNANCE, proposal, { kind: "token_listing" });
        await client.makeProposal(GOVERNANCE, proposal, {
            kind: "achievement",
            chitReward: 5000,
            maxAwards: 200,
        });

        expect(approvals().filter((a) => a.spender !== PROPOSALS_BOT)).toEqual([
            {
                ledger: SNS_LEDGER,
                spender: REGISTRY,
                amount: 50_000_100_000n,
                expiresIn: SEVEN_DAYS,
            },
            {
                ledger: SNS_LEDGER,
                spender: USER_INDEX,
                amount: 5000n * 200n * 20_000n + FEE,
                expiresIn: SEVEN_DAYS,
            },
        ]);
    });

    // Invariant: nothing is submitted unless every approval succeeded
    test("a failed approval submits nothing and says why", async () => {
        approved = false;

        expect(await client.makeProposal(GOVERNANCE, proposal)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "proposal.maker.approvalError" }),
        });
        expect(submissions()).toEqual([]);
    });

    // Invariant: a user who dismisses the PIN prompt approves and submits nothing. Both trees were
    // left busy for good.
    test("dismissing the PIN prompt sends nothing and reports the proposal as cancelled", async () => {
        pinNumberRequiredStore.set(true);

        const outcome = client.makeProposal(GOVERNANCE, proposal);
        pinNumberResolverStore.value?.reject();

        expect(await outcome).toEqual({ kind: "cancelled" });
        expect(sent).toEqual([]);
    });
});
