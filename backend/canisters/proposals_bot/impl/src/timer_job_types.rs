use crate::mutate_state;
use crate::updates::c2c_submit_proposal::submit_proposal;
use candid::Principal;
use canister_timer_jobs::Job;
use proposals_bot_canister::ProposalToSubmit;
use serde::{Deserialize, Serialize};
use types::icrc1::{Account, TransferArg};
use types::{CanisterId, ProposalId, SnsNeuronId, UserId};
use utils::time::SECOND_IN_MS;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    SubmitProposal(SubmitProposalJob),
    ProcessUserSubmittedProposalAdopted(ProcessUserSubmittedProposalAdoptedJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SubmitProposalJob {
    pub governance_canister_id: CanisterId,
    pub user_id: UserId,
    pub neuron_id: SnsNeuronId,
    pub proposal: ProposalToSubmit,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProcessUserSubmittedProposalAdoptedJob {
    pub governance_canister_id: CanisterId,
    pub proposal_id: ProposalId,
    pub user_id: UserId,
    pub ledger_canister_id: CanisterId,
    pub refund_amount: u128,
    pub fee: u128,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::SubmitProposal(job) => job.execute(),
            TimerJob::ProcessUserSubmittedProposalAdopted(job) => job.execute(),
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

impl Job for ProcessUserSubmittedProposalAdoptedJob {
    fn execute(self) {
        let transfer_args = TransferArg {
            from_subaccount: None,
            to: Account::from(Principal::from(self.user_id)),
            fee: Some(self.fee.into()),
            created_at_time: None,
            memo: None,
            amount: self.refund_amount.into(),
        };
        ic_cdk::spawn(async move {
            if icrc1_ledger_canister_c2c_client::icrc1_transfer(self.ledger_canister_id, &transfer_args)
                .await
                .is_err()
            {
                mutate_state(|state| {
                    let now = state.env.now();
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::ProcessUserSubmittedProposalAdopted(self),
                        now + (10 * SECOND_IN_MS),
                        now,
                    )
                })
            }
        })
    }
}
