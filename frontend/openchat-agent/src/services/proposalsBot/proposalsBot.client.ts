import type { HttpAgent, Identity } from "@dfinity/agent";
import { CandidService } from "../candidService";
import type {
    StakeNeuronForSubmittingProposalsResponse,
    TopUpNeuronResponse,
} from "openchat-shared";
import { stakeNeuronForSubmittingProposalsResponse, topUpNeuronResponse } from "./mappers";
import { principalStringToBytes } from "../../utils/mapping";
import {
    ProposalsBotStakeNeuronForSubmittingProposalsArgs,
    ProposalsBotStakeNeuronForSubmittingProposalsResponse,
    ProposalsBotTopUpNeuronArgs,
    ProposalsBotTopUpNeuronResponse,
} from "../../typebox";

export class ProposalsBotClient extends CandidService {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);
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
