import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type TranslationsService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
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

export class TranslationsClient extends CandidCanisterAgent<TranslationsService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory);
    }

    propose(locale: string, key: string, value: string): Promise<ProposeResponse> {
        return this.handleResponse(
            this.service.propose({
                key,
                locale,
                value,
            }),
            proposeResponse,
        );
    }

    approve(id: bigint): Promise<ApproveResponse> {
        return this.handleResponse(
            this.service.approve({
                id,
            }),
            approveResponse,
        );
    }

    reject(id: bigint, reason: RejectReason): Promise<RejectResponse> {
        return this.handleResponse(
            this.service.reject({
                id,
                reason: apiRejectReason(reason),
            }),
            rejectResponse,
        );
    }

    markDeployed(): Promise<MarkDeployedResponse> {
        return this.handleResponse(
            this.service.mark_deployed({
                latest_approval: BigInt(Date.now()),
            }),
            markDeployedResponse,
        );
    }

    proposed(): Promise<ProposedResponse> {
        return this.handleQueryResponse(
            () => this.service.proposed({}),
            proposedResponse,
        );
    }

    pendingDeployment(): Promise<PendingDeploymentResponse> {
        return this.handleQueryResponse(
            () => this.service.pending_deployment({}),
            pendingDeploymentResponse,
        );
    }
}
