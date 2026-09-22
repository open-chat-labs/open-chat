import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    ListNervousSystemFunctionsResponse,
    ManageNeuronResponse,
    ProposalVoteDetails,
} from "@shared";
import { type ApiListNeurons, idlFactory, type SnsGovernanceService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import {
    getProposalVoteDetails,
    manageNeuronResponse,
    nervousSystemFunctions,
    neuronIds,
} from "./mappers";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

const LIST_NEURONS_PAGE_SIZE = 100;

type ListNeuronsPage = {
    count: number;
    lastId: Uint8Array | number[] | undefined;
    neuronIds: Uint8Array[];
};

export class SnsGovernanceClient extends CandidCanisterAgent<SnsGovernanceService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "SnsGovernance");
    }

    // The ids of the neurons controlled by, or hot-keyed to, the caller which are not dissolved
    async listNeurons(): Promise<Uint8Array[]> {
        const principal = this.identity.getPrincipal();
        const neurons: Uint8Array[] = [];
        let startPageAt: [] | [{ id: Uint8Array }] = [];
        // The response is a page of neurons, so keep going until a page comes back short
        for (;;) {
            const args: ApiListNeurons = {
                of_principal: apiOptional(identity, principal),
                limit: LIST_NEURONS_PAGE_SIZE,
                start_page_at: startPageAt,
            };
            const page: ListNeuronsPage = await this.handleQueryResponse(
                () => this.service.list_neurons(args),
                (resp) => ({
                    count: resp.neurons.length,
                    lastId: resp.neurons[resp.neurons.length - 1]?.id[0]?.id,
                    neuronIds: neuronIds(resp, BigInt(Date.now())),
                }),
            );
            neurons.push(...page.neuronIds);
            if (page.count < LIST_NEURONS_PAGE_SIZE || page.lastId === undefined) break;
            startPageAt = [{ id: new Uint8Array(page.lastId) }];
        }
        return neurons;
    }

    registerVote(
        neuronId: Uint8Array,
        proposalId: bigint,
        vote: boolean,
    ): Promise<ManageNeuronResponse> {
        const args = {
            subaccount: neuronId,
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
            before_proposal: [{ id: proposalId + BigInt(1) }] as [{ id: bigint }],
            limit: 1,
            exclude_type: [],
            include_status: [],
        };
        return this.handleQueryResponse(
            () => this.service.list_proposals(args),
            getProposalVoteDetails,
        );
    }

    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse> {
        return this.handleQueryResponse(
            () => this.service.list_nervous_system_functions(),
            nervousSystemFunctions,
        );
    }
}
