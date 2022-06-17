use crate::{CanisterId, NeuronId, ProposalId, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Proposal {
    pub id: ProposalId,
    pub proposer: NeuronId,
    pub title: Option<String>,
    pub summary: String,
    pub url: String,
    pub deadline: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContent {
    pub governance_canister_id: CanisterId,
    pub proposal_id: ProposalId,
    pub proposer: NeuronId,
    pub title: Option<String>,
    pub summary: String,
    pub url: String,
    pub deadline: TimestampMillis,
    pub adopt_votes: u32,
    pub reject_votes: u32,
    pub my_vote: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ProposalContentInternal {
    pub governance_canister_id: CanisterId,
    pub proposal_id: ProposalId,
    pub proposer: NeuronId,
    pub title: Option<String>,
    pub summary: String,
    pub url: String,
    pub deadline: TimestampMillis,
    pub adopt_votes: HashSet<UserId>,
    pub reject_votes: HashSet<UserId>,
}

impl ProposalContentInternal {
    pub fn new(content: ProposalContent) -> ProposalContentInternal {
        ProposalContentInternal {
            governance_canister_id: content.governance_canister_id,
            proposal_id: content.proposal_id,
            proposer: content.proposer,
            title: content.title,
            summary: content.summary,
            url: content.url,
            deadline: content.deadline,
            adopt_votes: HashSet::new(),
            reject_votes: HashSet::new(),
        }
    }

    pub fn hydrate(&self, my_user_id: Option<UserId>) -> ProposalContent {
        ProposalContent {
            governance_canister_id: self.governance_canister_id,
            proposal_id: self.proposal_id,
            proposer: self.proposer,
            title: self.title.clone(),
            summary: self.summary.clone(),
            url: self.url.clone(),
            deadline: self.deadline,
            adopt_votes: self.adopt_votes.len() as u32,
            reject_votes: self.reject_votes.len() as u32,
            my_vote: my_user_id.and_then(|u| {
                self.adopt_votes
                    .contains(&u)
                    .then(|| true) // TODO use `then_some` once it is stable
                    .or_else(|| self.reject_votes.contains(&u).then(|| false))
            }),
        }
    }
}
