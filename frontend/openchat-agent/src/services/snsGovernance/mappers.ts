import type {
    ApiListNervousSystemFunctionsResponse,
    ApiListProposalsResponse,
    ApiManageNeuronResponse,
    ApiNervousSystemFunction,
    ApiSnsFunctionType
} from "./candid/idl";
import type {
    ListNervousSystemFunctionsResponse,
    ManageNeuronResponse,
    NervousSystemFunction,
    ProposalVoteDetails,
    SnsFunctionType
} from "openchat-shared";
import { identity, optional } from "../../utils/mapping";
import { proposalVote } from "../common/chatMappers";

const E8S_AS_BIGINT = BigInt(100_000_000);

export function manageNeuronResponse(candid: ApiManageNeuronResponse): ManageNeuronResponse {
    const result = candid.command[0]!;
    if ("RegisterVote" in result) {
        return {
            kind: "success",
        };
    }
    if ("Error" in result) {
        return {
            kind: "error",
            type: result.Error.error_type,
            message: result.Error.error_message,
        };
    }
    throw new Error(`Unexpected ApiManageNeuronResponse type received: ${candid}`);
}

export function getProposalVoteDetails(
    candid: ApiListProposalsResponse
): ProposalVoteDetails {
    const proposal = candid.proposals[0];
    if (proposal === undefined) {
        throw new Error("GetProposal returned an empty response");
    }
        const ballots = proposal.ballots;
        const tally = proposal.latest_tally[0]!;
        return {
            id: proposal.id[0]!.id,
            ballots: ballots.map(([n, b]) => ({
                neuronId: n,
                vote: proposalVote(b.vote),
                votingPower: b.voting_power,
            })),
            latestTally: {
                yes: Number(tally.yes / E8S_AS_BIGINT),
                no: Number(tally.no / E8S_AS_BIGINT),
                total: Number(tally.total / E8S_AS_BIGINT),
                timestamp: tally.timestamp_seconds * BigInt(1000)
            }
        };
}

export function nervousSystemFunctions(
    candid: ApiListNervousSystemFunctionsResponse
): ListNervousSystemFunctionsResponse {
    return {
        reservedIds: [...candid.reserved_ids],
        functions: candid.functions.map(nervousSystemFunction),
    };
}

function nervousSystemFunction(candid: ApiNervousSystemFunction): NervousSystemFunction {
    return {
        id: Number(candid.id),
        name: candid.name,
        description: optional(candid.description, identity) ?? "",
        functionType: optional(candid.function_type, snsFunctionType),
    };
}

function snsFunctionType(candid: ApiSnsFunctionType): SnsFunctionType {
    if ("NativeNervousSystemFunction" in candid) {
        return { kind: "native_nervous_system_function" };
    } else {
        return { kind: "generic_nervous_system_function" };
    }
}
