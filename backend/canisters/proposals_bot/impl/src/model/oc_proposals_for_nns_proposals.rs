use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ProposalId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct OCProposalsForNnsProposals {
    oc_proposals: HashMap<ProposalId, NnsProposal>,
}

impl OCProposalsForNnsProposals {
    pub fn push(&mut self, oc_proposal_id: u64, nns_proposal_id: u64, deadline: TimestampMillis) {
        self.oc_proposals.insert(
            oc_proposal_id,
            NnsProposal {
                proposal_id: nns_proposal_id,
                deadline,
                vote: None,
            },
        );
    }

    pub fn should_vote(&self, oc_proposal_id: &u64) -> Option<ProposalId> {
        self.oc_proposals
            .get(oc_proposal_id)
            .filter(|p| p.vote.is_none())
            .map(|p| p.proposal_id)
    }

    pub fn mark_vote_cast(&mut self, oc_proposal_id: &u64, vote: bool) {
        if let Some(p) = self.oc_proposals.get_mut(oc_proposal_id) {
            p.vote = Some(vote);
        }
    }
}

#[derive(Serialize, Deserialize)]
struct NnsProposal {
    proposal_id: u64,
    deadline: TimestampMillis,
    vote: Option<bool>,
}
