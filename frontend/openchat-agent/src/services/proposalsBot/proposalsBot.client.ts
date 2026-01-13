import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { SingleCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import {
    type CandidateProposal,
    nowNanos,
    type StakeNeuronForSubmittingProposalsResponse,
    type SubmitProposalResponse,
    type TopUpNeuronResponse,
} from "openchat-shared";
import {
    proposalToSubmit,
    stakeNeuronForSubmittingProposalsResponse,
    submitProposalResponse,
    topUpNeuronResponse,
} from "./mappers";
import { principalStringToBytes } from "../../utils/mapping";
import {
    ProposalsBotStakeNeuronForSubmittingProposalsArgs,
    ProposalsBotStakeNeuronForSubmittingProposalsResponse,
    ProposalsBotSubmitProposalArgs,
    ProposalsBotSubmitProposalResponse,
    ProposalsBotTopUpNeuronArgs,
    ProposalsBotTopUpNeuronResponse,
} from "../../typebox";
import { principalToIcrcAccount } from "../common/chatMappersV2";

export class ProposalsBotClient extends SingleCanisterMsgpackAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "ProposalsBot");
    }

    submitProposal(
        userId: string,
        governanceCanisterId: string,
        proposal: CandidateProposal,
        ledger: string,
        token: string,
        proposalRejectionFee: bigint,
        transactionFee: bigint,
    ): Promise<SubmitProposalResponse> {
        const args = {
            governance_canister_id: principalStringToBytes(governanceCanisterId),
            proposal: proposalToSubmit(proposal),
            transaction: {
                ledger: principalStringToBytes(ledger),
                token_symbol: token,
                amount: proposalRejectionFee + transactionFee,
                from: principalToIcrcAccount(userId),
                to: principalToIcrcAccount(this.canisterId),
                fee: transactionFee,
                memo: undefined,
                created: nowNanos(),
            },
        };
        return this.update(
            "submit_proposal",
            args,
            submitProposalResponse,
            ProposalsBotSubmitProposalArgs,
            ProposalsBotSubmitProposalResponse,
        );
    }

    stakeNeuronForSubmittingProposals(
        governanceCanisterId: string,
        stake: bigint,
    ): Promise<StakeNeuronForSubmittingProposalsResponse> {
        const args = {
            governance_canister_id: principalStringToBytes(governanceCanisterId),
            stake,
        };
        return this.update(
            "stake_neuron_for_submitting_proposals",
            args,
            stakeNeuronForSubmittingProposalsResponse,
            ProposalsBotStakeNeuronForSubmittingProposalsArgs,
            ProposalsBotStakeNeuronForSubmittingProposalsResponse,
        );
    }

    topUpNeuron(governanceCanisterId: string, amount: bigint): Promise<TopUpNeuronResponse> {
        const args = {
            governance_canister_id: principalStringToBytes(governanceCanisterId),
            amount,
        };
        return this.update(
            "top_up_neuron",
            args,
            topUpNeuronResponse,
            ProposalsBotTopUpNeuronArgs,
            ProposalsBotTopUpNeuronResponse,
        );
    }
}
