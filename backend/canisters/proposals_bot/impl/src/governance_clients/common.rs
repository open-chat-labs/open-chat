use candid::CandidType;
use serde::Deserialize;
use types::{NeuronId, Proposal, ProposalId};

pub trait RawProposal: TryInto<Proposal, Error = &'static str> {
    fn id(&self) -> ProposalId;

    fn is_excluded(&self) -> bool;
}

#[derive(CandidType, Deserialize)]
pub struct WrappedProposalId {
    pub id: ProposalId,
}

#[derive(CandidType, Deserialize)]
pub struct WrappedNeuronId {
    pub id: NeuronId,
}
