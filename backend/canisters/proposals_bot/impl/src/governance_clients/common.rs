use candid::CandidType;
use serde::Deserialize;
use types::{NeuronId, Proposal, ProposalId};

pub trait RawProposal: TryInto<Proposal, Error = &'static str> {
    fn id(&self) -> ProposalId;
}

#[derive(CandidType, Deserialize, Clone)]
pub struct WrappedProposalId {
    pub id: ProposalId,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct WrappedNeuronId {
    pub id: NeuronId,
}
