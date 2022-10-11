export var ProposalDecisionStatus;
(function (ProposalDecisionStatus) {
    ProposalDecisionStatus[ProposalDecisionStatus["Unspecified"] = 0] = "Unspecified";
    ProposalDecisionStatus[ProposalDecisionStatus["Failed"] = 1] = "Failed";
    ProposalDecisionStatus[ProposalDecisionStatus["Open"] = 2] = "Open";
    ProposalDecisionStatus[ProposalDecisionStatus["Rejected"] = 3] = "Rejected";
    ProposalDecisionStatus[ProposalDecisionStatus["Executed"] = 4] = "Executed";
    ProposalDecisionStatus[ProposalDecisionStatus["Adopted"] = 5] = "Adopted";
})(ProposalDecisionStatus || (ProposalDecisionStatus = {}));
export var ProposalRewardStatus;
(function (ProposalRewardStatus) {
    ProposalRewardStatus[ProposalRewardStatus["Unspecified"] = 0] = "Unspecified";
    ProposalRewardStatus[ProposalRewardStatus["AcceptVotes"] = 1] = "AcceptVotes";
    ProposalRewardStatus[ProposalRewardStatus["ReadyToSettle"] = 2] = "ReadyToSettle";
    ProposalRewardStatus[ProposalRewardStatus["Settled"] = 3] = "Settled";
})(ProposalRewardStatus || (ProposalRewardStatus = {}));
export var NnsProposalTopic;
(function (NnsProposalTopic) {
    NnsProposalTopic[NnsProposalTopic["Unspecified"] = 0] = "Unspecified";
    NnsProposalTopic[NnsProposalTopic["NeuronManagement"] = 1] = "NeuronManagement";
    NnsProposalTopic[NnsProposalTopic["ExchangeRate"] = 2] = "ExchangeRate";
    NnsProposalTopic[NnsProposalTopic["NetworkEconomics"] = 3] = "NetworkEconomics";
    NnsProposalTopic[NnsProposalTopic["Governance"] = 4] = "Governance";
    NnsProposalTopic[NnsProposalTopic["NodeAdmin"] = 5] = "NodeAdmin";
    NnsProposalTopic[NnsProposalTopic["ParticipantManagement"] = 6] = "ParticipantManagement";
    NnsProposalTopic[NnsProposalTopic["SubnetManagement"] = 7] = "SubnetManagement";
    NnsProposalTopic[NnsProposalTopic["NetworkCanisterManagement"] = 8] = "NetworkCanisterManagement";
    NnsProposalTopic[NnsProposalTopic["KYC"] = 9] = "KYC";
    NnsProposalTopic[NnsProposalTopic["NodeProviderRewards"] = 10] = "NodeProviderRewards";
    NnsProposalTopic[NnsProposalTopic["SnsDecentralizationSale"] = 11] = "SnsDecentralizationSale";
})(NnsProposalTopic || (NnsProposalTopic = {}));
export const defaultGroupRules = `- Do not impersonate others in a deceptive or misleading manner
- Do not intentionally share false or misleading information
- Keep messages relevant to the group

If you break the rules you might be blocked and/or have your message(s) deleted.`;
//# sourceMappingURL=chat.js.map