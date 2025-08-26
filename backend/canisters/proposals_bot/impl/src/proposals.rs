use nns_governance_canister::types::ProposalInfo;
use sns_governance_canister::types::ProposalData;
use types::Proposal;

pub const REWARD_STATUS_ACCEPT_VOTES: i32 = 1;
pub const REWARD_STATUS_READY_TO_SETTLE: i32 = 2;

pub trait RawProposal: TryInto<Proposal, Error = String> {}

impl RawProposal for ProposalData {}

impl RawProposal for ProposalInfo {}
