import type { Identity } from "@dfinity/agent";
import type { ManageNeuronResponse, ProposalVoteDetails } from "openchat-shared";
import { idlFactory, NnsGovernanceService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { INnsGovernanceClient } from "./nns.governance.client.interface";
import { getProposalVoteDetails, manageNeuronResponse } from "./mappers";
import type { AgentConfig } from "../../config";
import { apiOptional, apiProposalVote } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class NnsGovernanceClient extends CandidService implements INnsGovernanceClient {
    private service: NnsGovernanceService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<NnsGovernanceService>(
            idlFactory,
            canisterId,
            config
        );
    }

    static create(
        identity: Identity,
        config: AgentConfig,
        canisterId: string
    ): INnsGovernanceClient {
        return new NnsGovernanceClient(identity, config, canisterId);
    }

    registerVote(neuronId: string, proposalId: bigint, vote: boolean): Promise<ManageNeuronResponse> {
        const args = {
            id: apiOptional(identity, { id: BigInt(neuronId) }),
            command: apiOptional(identity, {
                RegisterVote: {
                    vote: apiProposalVote(vote),
                    proposal : apiOptional(identity, { id: proposalId })
                }
            })
        };
        return this.handleResponse(
            this.service.manage_neuron(args),
            manageNeuronResponse
        );
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
            getProposalVoteDetails
        )
    }
}
