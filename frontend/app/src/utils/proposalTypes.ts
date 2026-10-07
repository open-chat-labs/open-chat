export type ProposalType =
    | "motion"
    | "publish_bot"
    | "remove_bot"
    | "transfer_sns_funds"
    | "register_external_achievement"
    | "advance_sns_target_version"
    | "add_token"
    | "update_token"
    | "set_community_verification"
    | "set_group_verification"
    | "revoke_community_verification"
    | "revoke_group_verification";

const ANY_SNS_PROPOSAL_TYPES: ProposalType[] = [
    "motion",
    "transfer_sns_funds",
    "advance_sns_target_version",
];

// These execute OpenChat's own SNS functions, so only the CHAT SNS can carry them out.
export const CHAT_ONLY_PROPOSAL_TYPES: ProposalType[] = [
    "register_external_achievement",
    "add_token",
    "update_token",
    "publish_bot",
    "remove_bot",
    "set_community_verification",
    "set_group_verification",
    "revoke_community_verification",
    "revoke_group_verification",
];

// The proposal types to offer for an SNS, identified by its governance token symbol.
export function proposalTypesFor(symbol: string): ProposalType[] {
    return symbol === "CHAT"
        ? [...ANY_SNS_PROPOSAL_TYPES, ...CHAT_ONLY_PROPOSAL_TYPES]
        : ANY_SNS_PROPOSAL_TYPES;
}
