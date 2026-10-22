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
    minimumDissolveDelayToVoteSeconds,
    nervousSystemFunctions,
    votingNeurons,
} from "./mappers";
import type { VotingNeuron } from "../common/neurons";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

// The most neurons an SNS governance canister returns from `list_neurons`
const LIST_NEURONS_LIMIT = 100;

export class SnsGovernanceClient extends CandidCanisterAgent<SnsGovernanceService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "SnsGovernance");
    }

    // The neurons controlled by, or hot-keyed to, the caller which are not dissolved, keyed by
    // their subaccounts. When listing by principal the canister ignores `start_page_at`, so this
    // is a single call capped at the canister's limit.
    listNeurons(): Promise<VotingNeuron<Uint8Array>[]> {
        const args: ApiListNeurons = {
            of_principal: apiOptional(identity, this.identity.getPrincipal()),
            limit: LIST_NEURONS_LIMIT,
            start_page_at: [],
        };
        return this.handleQueryResponse(
            () => this.service.list_neurons(args),
            (resp) => votingNeurons(resp, BigInt(Date.now())),
        );
    }

    minimumDissolveDelayToVoteSeconds(): Promise<bigint | undefined> {
        return this.handleQueryResponse(
            () => this.service.get_nervous_system_parameters(null),
            minimumDissolveDelayToVoteSeconds,
        );
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
