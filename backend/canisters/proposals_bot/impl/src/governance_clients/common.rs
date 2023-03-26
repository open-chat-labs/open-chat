use candid::CandidType;
use serde::Deserialize;
use types::{Proposal, ProposalId, Tally};

pub const REWARD_STATUS_ACCEPT_VOTES: i32 = 1;
pub const REWARD_STATUS_READY_TO_SETTLE: i32 = 2;

pub trait RawProposal: TryInto<Proposal, Error = &'static str> {
    fn id(&self) -> ProposalId;
}

#[derive(CandidType, Deserialize, Clone)]
pub struct WrappedProposalId {
    pub id: ProposalId,
}

#[derive(CandidType, Deserialize)]
pub struct RawTally {
    pub yes: u64,
    pub no: u64,
    pub total: u64,
    pub timestamp_seconds: u64,
}

impl From<RawTally> for Tally {
    fn from(value: RawTally) -> Tally {
        Tally {
            yes: value.yes,
            no: value.no,
            total: value.total,
            timestamp: value.timestamp_seconds * 1000,
        }
    }
}
