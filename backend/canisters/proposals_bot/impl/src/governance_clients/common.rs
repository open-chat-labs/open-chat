use candid::CandidType;
use serde::Deserialize;
use types::{Proposal, ProposalId, Tally};

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
