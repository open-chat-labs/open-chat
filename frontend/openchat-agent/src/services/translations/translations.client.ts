import type { Identity } from "@dfinity/agent";
import { idlFactory, type TranslationsService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { AgentConfig } from "../../config";
import type {
    ApproveResponse,
    MarkDeployedResponse,
    PendingDeploymentResponse,
    ProposedResponse,
    ProposeResponse,
    RejectReason,
    RejectResponse,
} from "openchat-shared";
import {
    apiRejectReason,
    approveResponse,
    markDeployedResponse,
    pendingDeploymentResponse,
    proposedResponse,
    proposeResponse,
    rejectResponse,
} from "./mappers";

export class TranslationsClient extends CandidService {
    private translationService: TranslationsService;

    constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.translationService = this.createServiceClient<TranslationsService>(
            idlFactory,
            config.translationsCanister,
            config,
        );
    }

    propose(locale: string, key: string, value: string): Promise<ProposeResponse> {
        return this.handleResponse(
            this.translationService.propose({
                key,
                locale,
                value,
            }),
            proposeResponse,
        );
    }

    approve(id: bigint): Promise<ApproveResponse> {
        return this.handleResponse(
            this.translationService.approve({
                id,
            }),
            approveResponse,
        );
    }

    reject(id: bigint, reason: RejectReason): Promise<RejectResponse> {
        return this.handleResponse(
            this.translationService.reject({
                id,
                reason: apiRejectReason(reason),
            }),
            rejectResponse,
        );
    }

    markDeployed(): Promise<MarkDeployedResponse> {
        return this.handleResponse(
            this.translationService.mark_deployed({
                latest_approval: BigInt(Date.now()),
            }),
            markDeployedResponse,
        );
    }

    proposed(): Promise<ProposedResponse> {
        return this.handleQueryResponse(
            () => this.translationService.proposed({}),
            proposedResponse,
        );
    }

    pendingDeployment(): Promise<PendingDeploymentResponse> {
        return this.handleQueryResponse(
            () => this.translationService.pending_deployment({}),
            pendingDeploymentResponse,
        );
    }
}
