import type { Identity } from "@dfinity/agent";
import type { ProposalVoteDetails } from "openchat-shared";
import { idlFactory, NnsGovernanceService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { INnsGovernanceClient } from "./nns.governance.client.interface";
import { getProposalVoteDetails } from "./mappers";
import type { AgentConfig } from "../../config";

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

    getProposalVoteDetails(proposalId: bigint): Promise<ProposalVoteDetails> {
        const args = {
            include_reward_status: [],
            before_proposal: [{ id: proposalId + BigInt(1) }] as [{ id: bigint }],
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
