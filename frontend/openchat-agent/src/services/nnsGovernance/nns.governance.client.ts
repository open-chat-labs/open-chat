import type { HttpAgent, Identity } from "@dfinity/agent";
import type { ManageNeuronResponse, ProposalVoteDetails } from "openchat-shared";
import { idlFactory, type NnsGovernanceService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { getProposalVoteDetails, manageNeuronResponse } from "./mappers";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class NnsGovernanceClient extends CandidCanisterAgent<NnsGovernanceService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory);
    }

    registerVote(
        neuronId: string,
        proposalId: bigint,
        vote: boolean,
    ): Promise<ManageNeuronResponse> {
        const args = {
            id: apiOptional(identity, { id: BigInt(neuronId) }),
            command: apiOptional(identity, {
                RegisterVote: {
                    vote: apiProposalVote(vote),
                    proposal: apiOptional(identity, { id: proposalId }),
                },
            }),
        };
        return this.handleResponse(this.service.manage_neuron(args), manageNeuronResponse);
    }

    getProposalVoteDetails(proposalId: bigint): Promise<ProposalVoteDetails> {
        const args = {
            include_reward_status: [],
            before_proposal: apiOptional(identity, { id: proposalId + BigInt(1) }),
            limit: 1,
            exclude_topic: [],
            include_status: [],
        };
        return this.handleQueryResponse(
            () => this.service.list_proposals(args),
            getProposalVoteDetails,
        );
    }
}
