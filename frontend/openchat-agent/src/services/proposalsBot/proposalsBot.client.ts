import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { AgentConfig } from "../../config";
import type {
    Avatar,
    UpdateProposalsGroupResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import { idlFactory, ProposalsBotService } from "./candid/idl";
import type { IProposalsBotClient } from "./proposalsBot.client.interface";
import {
    updateProposalsGroupResponse,
} from "./mappers";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";
import { DataClient } from "../data/data.client";

export class ProposalsBotClient extends CandidService implements IProposalsBotClient {
    private proposalsBotService: ProposalsBotService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.proposalsBotService = this.createServiceClient<ProposalsBotService>(
            idlFactory,
            config.proposalsBotCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): IProposalsBotClient {
        return new ProposalsBotClient(identity, config);
    }

    updateGroupDetails(
        governanceCanisterId: string, 
        name?: string,
        description?: string,
        avatar?: Avatar): Promise<UpdateProposalsGroupResponse> {
        return this.handleResponse(
            this.proposalsBotService.update_group_details({ 
                governance_canister_id: Principal.fromText(governanceCanisterId),
                name: apiOptional(identity, name),
                description: apiOptional(identity, description),
                avatar:
                    avatar === undefined
                        ? { NoChange: null }
                        : {
                            SetToSome: {
                                id: DataClient.newBlobId(),
                                mime_type: avatar.mimeType,
                                data: avatar.data,
                            },
                        },
            }),
            updateProposalsGroupResponse)    
    }
}
