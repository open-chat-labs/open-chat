import type {
    ApiStakeNeuronForSubmittingProposalsResponse,
    ApiTopUpNeuronResponse,
} from "./candid/idl";
import type {
    StakeNeuronForSubmittingProposalsResponse,
    TopUpNeuronResponse,
} from "openchat-shared";
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

export function topUpNeuronResponse(candid: ApiTopUpNeuronResponse): TopUpNeuronResponse {
    if ("Success" in candid) {
        return CommonResponses.success();
    }
    console.warn("topUpNeuron failed with: ", candid);
    return CommonResponses.failure();
}
