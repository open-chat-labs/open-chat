import type { Identity } from "@dfinity/agent";
import type { ListNervousSystemFunctionsResponse, Tally } from "openchat-shared";
import { idlFactory, SnsGovernanceService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { ISnsGovernanceClient } from "./sns.governance.client.interface";
import { getTallyResponse, nervousSystemFunctions } from "../common/chatMappers";
import type { AgentConfig } from "../../config";

export class SnsGovernanceClient extends CandidService implements ISnsGovernanceClient {
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
    ): ISnsGovernanceClient {
        return new SnsGovernanceClient(identity, config, canisterId);
    }

    getTally(proposalId: bigint): Promise<Tally> {
        const args = {
            include_reward_status: [],
            before_proposal: [{ id: proposalId + BigInt(1) }] as [{ id: bigint }],
            limit: 1,
            exclude_type: [],
            include_status: [],
        };
        return this.handleQueryResponse(
            () => this.service.list_proposals(args),
            getTallyResponse
        )
    }

    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse> {
        return this.handleQueryResponse(
            () => this.service.list_nervous_system_functions(),
            nervousSystemFunctions
        );
    }
}
