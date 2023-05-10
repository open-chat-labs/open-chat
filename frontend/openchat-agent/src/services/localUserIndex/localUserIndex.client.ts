import type { Identity, SignIdentity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, LocalUserIndexService } from "./candid/idl";
import type {
    InviteUsersResponse,
    JoinGroupResponse,
    RegisterUserResponse,
    ReportMessageResponse
} from "openchat-shared";
import { CandidService } from "../candidService";
import { inviteUsersResponse, joinGroupResponse, registerUserResponse, reportMessageResponse } from "./mappers";
import type { ILocalUserIndexClient } from "./localUserIndex.client.interface";
import { profile } from "../common/profiling";
import type { AgentConfig } from "../../config";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

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

    static create(
        identity: Identity,
        config: AgentConfig,
        canisterId: string
    ): ILocalUserIndexClient {
        return new LocalUserIndexClient(identity, config, canisterId);
    }

    @profile("localUserIndexClient")
    registerUser(
        username: string,
        referralCode: string | undefined
    ): Promise<RegisterUserResponse> {
        return this.handleResponse(
            this.localUserIndexService.register_user({
                username,
                referral_code: apiOptional(identity, referralCode),
                public_key: new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer()),
            }),
            registerUserResponse
        );
    }

    @profile("localUserIndexClient")
    joinGroup(chatId: string): Promise<JoinGroupResponse> {
        return this.handleResponse(this.localUserIndexService.join_group({
            chat_id: Principal.fromText(chatId),
            invite_code: [],
            correlation_id: BigInt(0)
        }), joinGroupResponse);
    }

    @profile("localUserIndexClient")
    reportMessage(
        chatId: string,
        eventIndex: number,
        reasonCode: number,
        notes: string | undefined,
        threadRootMessageIndex: number | undefined
    ): Promise<ReportMessageResponse> {
        return this.handleResponse(
            this.localUserIndexService.report_message({
                chat_id: Principal.fromText(chatId),
                event_index: eventIndex,
                thread_root_message_index: apiOptional(identity, threadRootMessageIndex),
                notes: apiOptional(identity, notes),
                reason_code: reasonCode,
            }),
            reportMessageResponse
        );
    }

    @profile("localUserIndexClient")
    inviteUsersToGroup(chatId: string, userIds: string[]): Promise<InviteUsersResponse> {
        return this.handleResponse(this.localUserIndexService.invite_users_to_group({
            group_id: Principal.fromText(chatId),
            user_ids: userIds.map((u) => Principal.fromText(u)),
            correlation_id: BigInt(0)
        }), inviteUsersResponse);
    }
}
