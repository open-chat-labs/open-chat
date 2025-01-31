import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type TranslationsService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
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

export class TranslationsClient extends CanisterAgent {
    private translationService: TranslationsService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "Translations");

        this.translationService = this.createServiceClient<TranslationsService>(idlFactory);
    }

    propose(locale: string, key: string, value: string): Promise<ProposeResponse> {
        return this.handleResponse(
            this.translationService.propose({
                key,
                locale,
                value,
            }),
            "propose",
            proposeResponse,
        );
    }

    approve(id: bigint): Promise<ApproveResponse> {
        return this.handleResponse(
            this.translationService.approve({
                id,
            }),
            "approve",
            approveResponse,
        );
    }

    reject(id: bigint, reason: RejectReason): Promise<RejectResponse> {
        return this.handleResponse(
            this.translationService.reject({
                id,
                reason: apiRejectReason(reason),
            }),
            "reject",
            rejectResponse,
        );
    }

    markDeployed(): Promise<MarkDeployedResponse> {
        return this.handleResponse(
            this.translationService.mark_deployed({
                latest_approval: BigInt(Date.now()),
            }),
            "mark_deployed",
            markDeployedResponse,
        );
    }

    proposed(): Promise<ProposedResponse> {
        return this.handleQueryResponse(
            () => this.translationService.proposed({}),
            "proposed",
            proposedResponse,
        );
    }

    pendingDeployment(): Promise<PendingDeploymentResponse> {
        return this.handleQueryResponse(
            () => this.translationService.pending_deployment({}),
            "pending_deployment",
            pendingDeploymentResponse,
        );
    }
}
