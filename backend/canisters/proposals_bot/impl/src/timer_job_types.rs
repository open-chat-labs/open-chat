use crate::mutate_state;
use crate::updates::c2c_submit_proposal::{lookup_user_then_submit_proposal, submit_proposal};
use candid::Principal;
use canister_timer_jobs::Job;
use proposals_bot_canister::ProposalToSubmit;
use serde::{Deserialize, Serialize};
use sns_governance_canister::types::manage_neuron::claim_or_refresh::By;
use sns_governance_canister::types::manage_neuron::{ClaimOrRefresh, Command};
use sns_governance_canister::types::{manage_neuron_response, Empty, ManageNeuron};
use tracing::error;
use types::icrc1::{Account, TransferArg};
use types::{CanisterId, MultiUserChat, ProposalId, SnsNeuronId, UserId};
use utils::time::SECOND_IN_MS;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    SubmitProposal(SubmitProposalJob),
    LookupUserThenSubmitProposal(LookupUserThenSubmitProposalJob),
    ProcessUserSubmittedProposalAdopted(ProcessUserSubmittedProposalAdoptedJob),
    TopUpNeuron(TopUpNeuronJob),
    RefreshNeuron(RefreshNeuronJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SubmitProposalJob {
    pub governance_canister_id: CanisterId,
    pub user_id: UserId,
    pub neuron_id: SnsNeuronId,
    pub proposal: ProposalToSubmit,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LookupUserThenSubmitProposalJob {
    pub caller: Principal,
    pub user_index_canister_id: CanisterId,
    pub governance_canister_id: CanisterId,
    pub neuron_id: SnsNeuronId,
    pub chat: MultiUserChat,
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

#[derive(Serialize, Deserialize, Clone)]
pub struct TopUpNeuronJob {
    pub governance_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub neuron_id: SnsNeuronId,
    pub amount: u128,
    pub fee: u128,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RefreshNeuronJob {
    pub governance_canister_id: CanisterId,
    pub neuron_id: SnsNeuronId,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::SubmitProposal(job) => job.execute(),
            TimerJob::LookupUserThenSubmitProposal(job) => job.execute(),
            TimerJob::ProcessUserSubmittedProposalAdopted(job) => job.execute(),
            TimerJob::TopUpNeuron(job) => job.execute(),
            TimerJob::RefreshNeuron(job) => job.execute(),
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

impl Job for LookupUserThenSubmitProposalJob {
    fn execute(self) {
        ic_cdk::spawn(async move {
            lookup_user_then_submit_proposal(
                self.caller,
                self.user_index_canister_id,
                self.neuron_id,
                self.chat,
                self.governance_canister_id,
                self.proposal,
            )
            .await;
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

impl Job for TopUpNeuronJob {
    fn execute(self) {
        let transfer_args = TransferArg {
            from_subaccount: None,
            to: Account {
                owner: self.governance_canister_id,
                subaccount: Some(self.neuron_id),
            },
            fee: Some(self.fee.into()),
            created_at_time: None,
            memo: None,
            amount: self.amount.into(),
        };
        ic_cdk::spawn(async move {
            match icrc1_ledger_canister_c2c_client::icrc1_transfer(self.ledger_canister_id, &transfer_args).await {
                Ok(Ok(_)) => {
                    let refresh_job = RefreshNeuronJob {
                        governance_canister_id: self.governance_canister_id,
                        neuron_id: self.neuron_id,
                    };
                    refresh_job.execute();
                }
                Ok(Err(error)) => {
                    error!(?error, governance_canister_id = %self.governance_canister_id, amount = ?self.amount, "Failed to top up neuron");
                }
                Err(_) => mutate_state(|state| {
                    let now = state.env.now();
                    state
                        .data
                        .timer_jobs
                        .enqueue_job(TimerJob::TopUpNeuron(self), now + (10 * SECOND_IN_MS), now)
                }),
            }
        })
    }
}

impl Job for RefreshNeuronJob {
    fn execute(self) {
        let args = ManageNeuron {
            subaccount: self.neuron_id.to_vec(),
            command: Some(Command::ClaimOrRefresh(ClaimOrRefresh {
                by: Some(By::NeuronId(Empty {})),
            })),
        };

        ic_cdk::spawn(async move {
            match sns_governance_canister_c2c_client::manage_neuron(self.governance_canister_id, &args).await {
                Ok(response) => match response.command.unwrap() {
                    manage_neuron_response::Command::ClaimOrRefresh(_) => {}
                    manage_neuron_response::Command::Error(error) => {
                        error!(?error, governance_canister_id = %self.governance_canister_id, "Failed to refresh neuron")
                    }
                    _ => unreachable!(),
                },
                Err(_) => mutate_state(|state| {
                    let now = state.env.now();
                    state
                        .data
                        .timer_jobs
                        .enqueue_job(TimerJob::RefreshNeuron(self), now + (10 * SECOND_IN_MS), now);
                }),
            }
        })
    }
}
