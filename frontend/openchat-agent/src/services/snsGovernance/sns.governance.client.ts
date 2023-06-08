import type { Identity } from "@dfinity/agent";
import type {
    ListNervousSystemFunctionsResponse,
    ManageNeuronResponse,
    ProposalVoteDetails,
} from "openchat-shared";
import { idlFactory, SnsGovernanceService } from "./candid/idl";
import { CandidService } from "../candidService";
import { getProposalVoteDetails, manageNeuronResponse, nervousSystemFunctions } from "./mappers";
import type { AgentConfig } from "../../config";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";
import { toUint8Array } from "../../utils/base64";

export class SnsGovernanceClient extends CandidService {
    private service: SnsGovernanceService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<SnsGovernanceService>(
            idlFactory,
            canisterId,
            config
        );
    }

    static create(
        identity: Identity,
        config: AgentConfig,
        canisterId: string
    ): SnsGovernanceClient {
        return new SnsGovernanceClient(identity, config, canisterId);
    }

    registerVote(
        neuronId: string,
        proposalId: bigint,
        vote: boolean
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
            getProposalVoteDetails
        );
    }

    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse> {
        return this.handleQueryResponse(
            () => this.service.list_nervous_system_functions(),
            nervousSystemFunctions
        );
    }
}
