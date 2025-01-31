import type { HttpAgent, Identity } from "@dfinity/agent";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";
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
import { apiToken, principalToIcrcAccount } from "../common/chatMappersV2";

export class ProposalsBotClient extends MsgpackCanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
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
                token: apiToken(token),
                amount: proposalRejectionFee,
                from: principalToIcrcAccount(userId),
                to: principalToIcrcAccount(this.canisterId),
                fee: transactionFee,
                memo: undefined,
                created: nowNanos(),
            },
        };
        return this.executeMsgpackUpdate(
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
        return this.executeMsgpackUpdate(
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
        return this.executeMsgpackUpdate(
            "top_up_neuron",
            args,
            topUpNeuronResponse,
            ProposalsBotTopUpNeuronArgs,
            ProposalsBotTopUpNeuronResponse,
        );
    }
}
