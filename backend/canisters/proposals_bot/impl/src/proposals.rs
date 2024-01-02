use nns_governance_canister::types::ProposalInfo;
use sns_governance_canister::types::ProposalData;
use types::{Proposal, ProposalId};

pub const REWARD_STATUS_ACCEPT_VOTES: i32 = 1;
pub const REWARD_STATUS_READY_TO_SETTLE: i32 = 2;

pub trait RawProposal: TryInto<Proposal, Error = String> {
    fn id(&self) -> ProposalId;
}

impl RawProposal for ProposalData {
    fn id(&self) -> ProposalId {
        self.id.as_ref().map_or(ProposalId::default(), |p| p.id)
    }
}

impl RawProposal for ProposalInfo {
    fn id(&self) -> ProposalId {
        self.id.as_ref().map_or(ProposalId::default(), |p| p.id)
    }
}
