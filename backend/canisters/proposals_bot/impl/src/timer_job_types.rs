use crate::updates::c2c_submit_proposal::submit_proposal;
use canister_timer_jobs::Job;
use proposals_bot_canister::ProposalToSubmit;
use serde::{Deserialize, Serialize};
use types::{CanisterId, SnsNeuronId, UserId};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    SubmitProposal(SubmitProposalJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SubmitProposalJob {
    pub governance_canister_id: CanisterId,
    pub user_id: UserId,
    pub neuron_id: SnsNeuronId,
    pub proposal: ProposalToSubmit,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::SubmitProposal(job) => job.execute(),
        }
    }
}

impl Job for SubmitProposalJob {
    fn execute(self) {
        ic_cdk::spawn(async move {
            submit_proposal(self.user_id, self.governance_canister_id, self.neuron_id, self.proposal).await;
        });
    }
}
