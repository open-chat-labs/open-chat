import type { ApiStakeNeuronForSubmittingProposalsResponse } from "./candid/idl";
import type { StakeNeuronForSubmittingProposalsResponse } from "openchat-shared";
import { CommonResponses } from "openchat-shared";

export function stakeNeuronForSubmittingProposalsResponse(
    candid: ApiStakeNeuronForSubmittingProposalsResponse,
): StakeNeuronForSubmittingProposalsResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    }
    console.warn("stakeNeuronForSubmittingProposals failed with: ", candid);
    return CommonResponses.failure();
}
