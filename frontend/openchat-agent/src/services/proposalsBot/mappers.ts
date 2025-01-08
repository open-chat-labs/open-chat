import {
    type CandidateProposal,
    type CandidateProposalAction,
    type StakeNeuronForSubmittingProposalsResponse,
    type SubmitProposalResponse,
    type TopUpNeuronResponse,
    UnsupportedValueError,
} from "openchat-shared";
import { CommonResponses } from "openchat-shared";
import type {
    ProposalsBotProposalToSubmit,
    ProposalsBotProposalToSubmitAction,
    ProposalsBotStakeNeuronForSubmittingProposalsResponse,
    ProposalsBotSubmitProposalResponse,
    ProposalsBotTopUpNeuronResponse,
} from "../../typebox";
import { hexStringToBytes, mapOptional, principalStringToBytes } from "../../utils/mapping";

export function submitProposalResponse(
    value: ProposalsBotSubmitProposalResponse,
): SubmitProposalResponse {
    if (value === "Success") {
        return { kind: "success" };
    }
    if (value === "GovernanceCanisterNotSupported") {
        return { kind: "governance_canister_not_supported" };
    }
    if (typeof value === "object") {
        if ("Retrying" in value) {
            return { kind: "retrying", error: value.Retrying };
        }
        if ("InsufficientPayment" in value) {
            return { kind: "insufficient_payment" };
        }
        if ("PaymentFailed" in value) {
            return { kind: "transfer_failed", error: value.PaymentFailed };
        }
        if ("InternalError" in value) {
            return { kind: "internal_error", error: value.InternalError };
        }
    }
    throw new UnsupportedValueError("Unexpected ApiSubmitProposalResponse type received", value);
}

export function stakeNeuronForSubmittingProposalsResponse(
    value: ProposalsBotStakeNeuronForSubmittingProposalsResponse,
): StakeNeuronForSubmittingProposalsResponse {
    if (typeof value === "object" && "Success" in value) {
        return CommonResponses.success();
    }
    console.warn("stakeNeuronForSubmittingProposals failed with: ", value);
    return CommonResponses.failure();
}

export function topUpNeuronResponse(value: ProposalsBotTopUpNeuronResponse): TopUpNeuronResponse {
    if (typeof value === "object" && "Success" in value) {
        return CommonResponses.success();
    }
    console.warn("topUpNeuron failed with: ", value);
    return CommonResponses.failure();
}

export function proposalToSubmit(proposal: CandidateProposal): ProposalsBotProposalToSubmit {
    return {
        title: proposal.title,
        url: proposal.url ?? "",
        summary: proposal.summary,
        action: proposalAction(proposal.action),
    };
}

function proposalAction(action: CandidateProposalAction): ProposalsBotProposalToSubmitAction {
    switch (action.kind) {
        case "motion":
            return "Motion";
        case "transfer_sns_funds":
            return {
                TransferSnsTreasuryFunds: {
                    to: {
                        owner: principalStringToBytes(action.recipient.owner),
                        subaccount: mapOptional(
                            action.recipient.subaccount,
                            (s) =>
                                [...hexStringToBytes(s)] as [
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                    number,
                                ],
                        ),
                    },
                    amount: action.amount,
                    memo: undefined,
                    treasury: action.treasury,
                },
            };
        case "upgrade_sns_to_next_version":
            return "UpgradeSnsToNextVersion";
        case "execute_generic_nervous_system_function":
            return {
                ExecuteGenericNervousSystemFunction: {
                    function_id: action.functionId,
                    payload: action.payload,
                },
            };
    }
}
