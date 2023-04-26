import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, LocalUserIndexService } from "./candid/idl";
import type { JoinGroupResponse, ReportMessageResponse } from "openchat-shared";
import { CandidService } from "../candidService";
import { joinGroupResponse, reportMessageResponse } from "./mappers";
import type { ILocalUserIndexClient } from "./localUserIndex.client.interface";
import { profile } from "../common/profiling";
import type { AgentConfig } from "../../config";
import { apiOptional } from "../common/chatMappers";
import { textToCode } from "openchat-shared";
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
    joinGroup(chatId: string, inviteCode: string | undefined): Promise<JoinGroupResponse> {
        return this.handleResponse(
            this.localUserIndexService.join_group({
                chat_id: Principal.fromText(chatId),
                invite_code: apiOptional(textToCode, inviteCode),
                correlation_id: BigInt(0),
            }),
            joinGroupResponse
        );
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
}
