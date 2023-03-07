import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, LocalUserIndexService } from "./candid/idl";
import type {
    JoinGroupResponse,
} from "openchat-shared";
import { CandidService } from "../candidService";
import { joinGroupResponse } from "./mappers";
import type { ILocalUserIndexClient } from "./localUserIndex.client.interface";
import { profile } from "../common/profiling";
import type { AgentConfig } from "../../config";
import { apiOptional } from "../common/chatMappers";
import { textToCode } from "openchat-shared";

export class LocalUserIndexClient extends CandidService implements ILocalUserIndexClient {
    private localUserIndexService: LocalUserIndexService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.localUserIndexService = this.createServiceClient<LocalUserIndexService>(
            idlFactory,
            canisterId,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig, canisterId: string): ILocalUserIndexClient {
        return new LocalUserIndexClient(identity, config, canisterId);
    }

    @profile("localUserIndexClient")
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse> {
        return this.handleResponse(this.localUserIndexService.join_group({
            chat_id: Principal.fromText(chatId),
            as_super_admin: false,
            invite_code: apiOptional(textToCode, inviteCode),
            correlation_id: BigInt(0)
        }), joinGroupResponse);
    }
}
