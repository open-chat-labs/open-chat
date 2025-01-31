import type { HttpAgent, Identity } from "@dfinity/agent";
import type {
    ListNervousSystemFunctionsResponse,
    ManageNeuronResponse,
    ProposalVoteDetails,
} from "openchat-shared";
import { idlFactory, type SnsGovernanceService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import { getProposalVoteDetails, manageNeuronResponse, nervousSystemFunctions } from "./mappers";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";
import { toUint8Array } from "../../utils/base64";

export class SnsGovernanceClient extends CanisterAgent {
    private service: SnsGovernanceService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);

        this.service = this.createServiceClient<SnsGovernanceService>(idlFactory);
    }

    registerVote(
        neuronId: string,
        proposalId: bigint,
        vote: boolean,
    ): Promise<ManageNeuronResponse> {
        const args = {
            subaccount: toUint8Array(neuronId),
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
