import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { ManageNeuronResponse, ProposalVoteDetails } from "@shared";
import { type ApiListNeurons, idlFactory, type NnsGovernanceService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { getProposalVoteDetails, manageNeuronResponse, neuronIds } from "./mappers";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

// The most neurons the NNS governance canister returns per `list_neurons` call
const NNS_LIST_NEURONS_PAGE_SIZE = 50;
const MAX_LIST_NEURONS_PAGES = 20;

type ListNeuronsPage = {
    neuronIds: string[];
    totalPages: number;
};

export class NnsGovernanceClient extends CandidCanisterAgent<NnsGovernanceService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "NnsGovernance");
    }

    // The ids of the neurons controlled by, or hot-keyed to, the caller which are not dissolved.
    // The canister returns at most `NNS_LIST_NEURONS_PAGE_SIZE` neurons per call, so page through
    // them, up to a sensible cap.
    async listNeurons(): Promise<string[]> {
        const neurons: string[] = [];
        for (let pageNumber = 0; pageNumber < MAX_LIST_NEURONS_PAGES; pageNumber++) {
            const args: ApiListNeurons = {
                neuron_ids: [],
                include_neurons_readable_by_caller: true,
                include_empty_neurons_readable_by_caller: [],
                include_public_neurons_in_full_neurons: [],
                page_number: [BigInt(pageNumber)],
                page_size: [BigInt(NNS_LIST_NEURONS_PAGE_SIZE)],
            };
            const page: ListNeuronsPage = await this.handleQueryResponse(
                () => this.service.list_neurons(args),
                (resp) => ({
                    neuronIds: neuronIds(resp, BigInt(Date.now())),
                    totalPages: Number(resp.total_pages_available[0] ?? BigInt(1)),
                }),
            );
            neurons.push(...page.neuronIds);
            if (pageNumber + 1 >= page.totalPages) break;
        }
        return neurons;
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
