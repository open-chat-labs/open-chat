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
    ErrorCode,
    anonymousUser,
    type ProposalContent,
    type RegisterProposalVoteResponse,
    type WorkerRequest,
} from "@shared";
import type { OpenChatConfig } from "./config";
import { OpenChat } from "./openchat";
import { currentUserStore } from "./state";
import { proposalVotesStore } from "./stores/proposalVotes";
import { WorkerAgent } from "./workerAgent";

class FakeWorker {
    onmessage: ((ev: MessageEvent) => void) | undefined;
    postMessage() {}
    addEventListener() {}
}

function config(): OpenChatConfig {
    return {
        mobileLayout: "v1",
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
        proposalBotCanister: "aaaaa-aa",
    } as unknown as OpenChatConfig;
}

const chatId = { kind: "group_chat" as const, groupId: "bbbbb-bb" };
const messageId = 1n;
const content = {
    kind: "proposal_content",
    governanceCanisterId: "rrkah-fqaaa-aaaaa-aaaaq-cai",
    proposal: { kind: "nns", id: 42n },
} as unknown as ProposalContent;

describe("voting on a proposal", () => {
    let client: OpenChat;
    let votes: WorkerRequest[];

    function respondToVotesWith(vote: () => Promise<RegisterProposalVoteResponse>) {
        vi.spyOn(WorkerAgent.prototype, "send").mockImplementation(((req: WorkerRequest) => {
            if (req.kind !== "registerProposalVote") return new Promise(() => {});
            votes.push(req);
            return vote();
        }) as never);
    }

    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        currentUserStore.set({ ...anonymousUser(), userId: "me" });
        client = new OpenChat(config());
        votes = [];
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        currentUserStore.set(anonymousUser());
        proposalVotesStore.clear();
    });

    // Invariant 1: no vote request while a vote on that message is in flight or recorded
    test("a second tap while the vote is in flight, or once it has gone through, sends nothing", async () => {
        respondToVotesWith(() => Promise.resolve({ kind: "success" }));

        const first = client.voteOnProposal(chatId, 0, messageId, content, true);
        expect(await client.voteOnProposal(chatId, 0, messageId, content, false)).toEqual({
            kind: "skipped",
        });
        expect(await first).toEqual({ kind: "voted" });
        expect(await client.voteOnProposal(chatId, 0, messageId, content, false)).toEqual({
            kind: "skipped",
        });
        expect(
            await client.voteOnProposal(chatId, 0, 2n, { ...content, myVote: true }, false),
        ).toEqual({ kind: "skipped" });

        expect(votes).toHaveLength(1);
        expect(proposalVotesStore.get(messageId)).toBe("adopted");
    });

    // Invariant 2: a failed vote leaves nothing recorded, so the user can vote again
    test("a failed vote is cleared and can be retried", async () => {
        respondToVotesWith(() =>
            Promise.resolve({
                kind: "error",
                code: ErrorCode.ProposalNotAcceptingVotes,
                message: undefined,
            }),
        );

        expect(await client.voteOnProposal(chatId, 0, messageId, content, true)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "proposal.proposalNotAcceptingVotes" }),
        });
        expect(proposalVotesStore.has(messageId)).toBe(false);

        await client.voteOnProposal(chatId, 0, messageId, content, true);
        expect(votes).toHaveLength(2);
    });

    // Invariant 2: a failed vote leaves nothing recorded, so the user can vote again
    test("a vote whose request is rejected is cleared and reported", async () => {
        respondToVotesWith(() => Promise.reject(new Error("worker gone")));

        expect(await client.voteOnProposal(chatId, 0, messageId, content, true)).toEqual({
            kind: "failed",
            message: expect.objectContaining({ key: "proposal.voteFailed" }),
        });
        expect(proposalVotesStore.has(messageId)).toBe(false);
    });
});
