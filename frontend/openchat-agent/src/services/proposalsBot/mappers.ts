import type {
    StakeNeuronForSubmittingProposalsResponse,
    TopUpNeuronResponse,
} from "openchat-shared";
import { CommonResponses } from "openchat-shared";
import type {
    ProposalsBotStakeNeuronForSubmittingProposalsResponse,
    ProposalsBotTopUpNeuronResponse,
} from "../../typebox";

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
