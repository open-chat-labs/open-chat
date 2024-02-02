import type {
    ApproveResponse,
    CandidateTranslation,
    MarkDeployedResponse,
    PendingDeploymentResponse,
    ProposeResponse,
    ProposedResponse,
    RejectResponse,
} from "openchat-shared";
import type {
    ApiApproveResponse,
    ApiCandidateTranslation,
    ApiMarkDeployedResponse,
    ApiPendingDeploymentResponse,
    ApiProposeResponse,
    ApiProposedResponse,
    ApiRejectResponse,
} from "./candid/idl";

function candidateTranslation(candid: ApiCandidateTranslation): CandidateTranslation {
    return {
        id: candid.id,
        value: candid.value,
        proposedAt: candid.proposed_at,
        proposedBy: candid.proposed_by.toString(),
    };
}

export function proposedResponse(candid: ApiProposedResponse): ProposedResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            proposed: candid.Success.records.map((c) => ({
                key: c.key,
                locale: c.locale,
                deploymentCount: c.deployment_count,
                candidates: c.candidates.map(candidateTranslation),
            })),
        };
    }

    console.warn("proposed translations failed with: ", candid);
    return { kind: "failure" };
}

export function pendingDeploymentResponse(
    candid: ApiPendingDeploymentResponse,
): PendingDeploymentResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            latestApproval: candid.Success.latest_approval,
            translations: candid.Success.translations.map(({ locale, key, value }) => ({
                locale,
                key,
                value,
            })),
        };
    }
    console.warn("pending deployments failed with", candid);
    return { kind: "failure" };
}

export function proposeResponse(candid: ApiProposeResponse): ProposeResponse {
    if ("Success" in candid) {
        return "success";
    }

    if ("AlreadyProposed" in candid) {
        return "already_proposed";
    }

    console.warn("propose translation failed with: ", candid);
    return "failure";
}

export function approveResponse(candid: ApiApproveResponse): ApproveResponse {
    if ("Success" in candid) {
        return "success";
    }
    console.warn("approve translation failed with: ", candid);
    return "failure";
}

export function rejectResponse(candid: ApiRejectResponse): RejectResponse {
    if ("Success" in candid) {
        return "success";
    }
    console.warn("reject translation failed with: ", candid);
    return "failure";
}

export function markDeployedResponse(candid: ApiMarkDeployedResponse): MarkDeployedResponse {
    if ("Success" in candid) {
        return "success";
    }
    console.warn("mark translations deployed failed with: ", candid);
    return "failure";
}
