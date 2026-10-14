import {
    anonymousUser,
    cryptoBalanceStore,
    currentUserStore,
    LEDGER_CANISTER_CHAT,
    type MultiUserChat,
    type NervousSystemDetails,
    type OpenChat,
} from "@client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProposalForm, type ProposalSubForm } from "./proposalForm.svelte";

const nervousSystem = {
    governanceCanisterId: "governance",
    proposalRejectionFee: 400_000_000n,
    token: { ledger: LEDGER_CANISTER_CHAT, symbol: "CHAT", transferFee: 100_000n, decimals: 8 },
} as unknown as NervousSystemDetails;

const chat = {
    kind: "group_chat",
    id: { kind: "group_chat", groupId: "rrkah-fqaaa-aaaaa-aaaaq-cai" },
} as unknown as MultiUserChat;

const revoke: ProposalSubForm = {
    convertAction: () => ({
        kind: "execute_generic_nervous_system_function",
        functionId: 1017n,
        payload: new Uint8Array([1]),
    }),
};

function fakeClient() {
    const makeProposal = vi.fn<OpenChat["makeProposal"]>(async () => ({ kind: "submitted" }));
    return { client: { makeProposal } as unknown as OpenChat, makeProposal };
}

// A form with enough in the wallet, at the step for the fields of the proposal's type
function form(client: OpenChat): ProposalForm {
    cryptoBalanceStore.setBalance(LEDGER_CANISTER_CHAT, 100_000_000_000n);
    const form = new ProposalForm(client, chat, nervousSystem);
    form.balanceRefreshed();
    form.title = "Title";
    form.summary = "Summary";
    return form;
}

describe("making a proposal", () => {
    afterEach(() => {
        cryptoBalanceStore.setBalance(LEDGER_CANISTER_CHAT, 0n);
        currentUserStore.set(anonymousUser());
    });

    // Invariant: every proposal type offered can be submitted once its form is valid. Revoking a
    // verification never could in either tree.
    test("a proposal to revoke a verification can be submitted", async () => {
        const { client, makeProposal } = fakeClient();
        const f = form(client);
        f.type = "revoke_group_verification";
        f.next();
        f.subForm = revoke;
        f.subFormValid = true;

        expect(f.valid).toBe(true);
        expect((await f.submit()).kind).toBe("submitted");
        expect(makeProposal).toHaveBeenCalledTimes(1);
    });

    // Invariant: nothing is approved or submitted for a proposal whose action can't be built. Removing
    // a bot approved the fee and then submitted nothing, since neither tree bound its form.
    test("a proposal whose form gives no action approves and submits nothing", async () => {
        const { client, makeProposal } = fakeClient();
        const f = form(client);
        f.type = "remove_bot";
        f.next();
        f.subFormValid = true;

        expect((await f.submit()).kind).toBe("invalid");
        expect(makeProposal).not.toHaveBeenCalled();
    });

    // Invariant: a proposal can't be submitted unless the wallet also holds the payment its execution
    // takes, as well as the fee
    test("a token listing needs the listing fee in the wallet as well as the proposal fee", async () => {
        const { client, makeProposal } = fakeClient();
        cryptoBalanceStore.setBalance(LEDGER_CANISTER_CHAT, 1_000_000_000n);
        const f = new ProposalForm(client, chat, nervousSystem);
        f.balanceRefreshed();
        f.title = "Title";
        f.summary = "Summary";
        f.type = "add_token";
        f.next();
        f.tokenLedgerCanisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
        f.tokenTransactionUrlFormat = "https://token.com/{transaction_index}";

        expect(f.step).toBe("action");
        expect(f.valid).toBe(false);
        expect((await f.submit()).kind).toBe("invalid");
        expect(makeProposal).not.toHaveBeenCalled();
    });

    // Invariant: the payment a proposal's execution takes reaches the client, so it gets approved
    test("a token listing and an achievement pass their execution payment on, an update doesn't", async () => {
        // The payloads name the user as the payer
        currentUserStore.set({ ...anonymousUser(), userId: "dfdal-2uaaa-aaaaa-qaama-cai" });
        const { client, makeProposal } = fakeClient();
        const f = form(client);
        f.next();
        f.tokenLedgerCanisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
        f.tokenTransactionUrlFormat = "https://token.com/{transaction_index}";

        f.type = "add_token";
        await f.submit();
        f.type = "update_token";
        await f.submit();
        f.type = "register_external_achievement";
        f.achievementName = "Achievement";
        f.achievementUrl = "https://myapp.xyz/register";
        f.awardingAchievementCanisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai";
        f.chitRewardText = "6000";
        f.maxAwardsText = "300";
        await f.submit();

        expect(makeProposal.mock.calls.map((call) => call[2])).toEqual([
            { kind: "token_listing" },
            undefined,
            { kind: "achievement", chitReward: 6000, maxAwards: 300 },
        ]);
    });
});
