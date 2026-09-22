import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { ManageNeuronResponse, ProposalVoteDetails } from "@shared";
import { type ApiListNeurons, idlFactory, type NnsGovernanceService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { getProposalVoteDetails, manageNeuronResponse, neuronIds } from "./mappers";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class NnsGovernanceClient extends CandidCanisterAgent<NnsGovernanceService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "NnsGovernance");
    }

    // The ids of the neurons controlled by, or hot-keyed to, the caller which are not dissolved
    listNeurons(): Promise<string[]> {
        const args: ApiListNeurons = {
            neuron_ids: [],
            include_neurons_readable_by_caller: true,
            include_empty_neurons_readable_by_caller: [],
            include_public_neurons_in_full_neurons: [],
            page_number: [],
            page_size: [],
        };
        return this.handleQueryResponse(
            () => this.service.list_neurons(args),
            (resp) => neuronIds(resp, BigInt(Date.now())),
        );
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
