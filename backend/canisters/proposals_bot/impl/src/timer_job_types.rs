use crate::updates::submit_proposal::{LinkedNnsProposal, submit_proposal};
use crate::{UserIdAndPayment, mutate_state};
use canister_timer_jobs::Job;
use constants::{MINUTE_IN_MS, SECOND_IN_MS};
use icrc_ledger_types::icrc1::{account::Account, transfer::TransferArg};
use proposals_bot_canister::ProposalToSubmit;
use serde::{Deserialize, Serialize};
use sns_governance_canister::types::manage_neuron::claim_or_refresh::By;
use sns_governance_canister::types::manage_neuron::{ClaimOrRefresh, Command};
use sns_governance_canister::types::{Empty, ManageNeuron, get_proposal_response, manage_neuron_response};
use tracing::error;
use types::{CanisterId, NnsNeuronId, ProposalId, SnsNeuronId, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    SubmitProposal(Box<SubmitProposalJob>),
    ProcessUserRefund(ProcessUserRefundJob),
    TopUpNeuron(TopUpNeuronJob),
    RefreshNeuron(RefreshNeuronJob),
    VoteOnNnsProposal(VoteOnNnsProposalJob),
    CheckSnsProposalTallyThenVoteOnNnsProposal(CheckSnsProposalTallyThenVoteOnNnsProposalJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SubmitProposalJob {
    pub governance_canister_id: CanisterId,
    pub neuron_id: SnsNeuronId,
    pub proposal: ProposalToSubmit,
    pub user_id_and_payment: Option<UserIdAndPayment>,
    pub linked_nns_proposal: Option<LinkedNnsProposal>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProcessUserRefundJob {
    pub user_id: UserId,
    pub ledger_canister_id: CanisterId,
    pub amount: u128,
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

#[derive(Serialize, Deserialize, Clone)]
pub struct VoteOnNnsProposalJob {
    pub nns_governance_canister_id: CanisterId,
    pub neuron_id: NnsNeuronId,
    pub proposal_id: ProposalId,
    pub vote: bool,
}

// When this job runs it will query the tally of the specified SNS proposal, then based
// on that tally it will vote to either approve or reject the linked NNS proposal
#[derive(Serialize, Deserialize, Clone)]
pub struct CheckSnsProposalTallyThenVoteOnNnsProposalJob {
    pub sns_governance_canister_id: CanisterId,
    pub sns_proposal_id: ProposalId,
    pub nns_governance_canister_id: CanisterId,
    pub nns_neuron_id: NnsNeuronId,
    pub nns_proposal_id: ProposalId,
    pub nns_proposal_deadline: TimestampMillis,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::SubmitProposal(job) => job.execute(),
            TimerJob::ProcessUserRefund(job) => job.execute(),
            TimerJob::TopUpNeuron(job) => job.execute(),
            TimerJob::RefreshNeuron(job) => job.execute(),
            TimerJob::VoteOnNnsProposal(job) => job.execute(),
            TimerJob::CheckSnsProposalTallyThenVoteOnNnsProposal(job) => job.execute(),
        }
    }
}

impl Job for SubmitProposalJob {
    fn execute(self) {
        ic_cdk::futures::spawn(async move {
            submit_proposal(
                self.user_id_and_payment,
                self.governance_canister_id,
                self.neuron_id,
                self.proposal,
                self.linked_nns_proposal,
            )
            .await;
        });
    }
}

impl Job for ProcessUserRefundJob {
    fn execute(self) {
        let transfer_args = TransferArg {
            from_subaccount: None,
            to: self.user_id.into(),
            fee: Some(self.fee.into()),
            created_at_time: None,
            memo: None,
            amount: self.amount.into(),
        };
        ic_cdk::futures::spawn(async move {
            match icrc_ledger_canister_c2c_client::icrc1_transfer(self.ledger_canister_id, &transfer_args).await {
                Ok(Ok(_)) => {}
                Ok(Err(error)) => {
                    error!(user_id = %self.user_id, ledger = %self.ledger_canister_id, ?error, "Failed to refund user");
                }
                Err(error) => mutate_state(|state| {
                    error!(user_id = %self.user_id, ledger = %self.ledger_canister_id, ?error, "Failed to refund user, retrying");
                    let now = state.env.now();
                    state
                        .data
                        .timer_jobs
                        .enqueue_job(TimerJob::ProcessUserRefund(self), now + (10 * SECOND_IN_MS), now)
                }),
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
        ic_cdk::futures::spawn(async move {
            match icrc_ledger_canister_c2c_client::icrc1_transfer(self.ledger_canister_id, &transfer_args).await {
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

        ic_cdk::futures::spawn(async move {
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

impl Job for VoteOnNnsProposalJob {
    fn execute(self) {
        use nns_governance_canister::types::manage_neuron;
        use nns_governance_canister::types::manage_neuron_response;

        let args = nns_governance_canister::manage_neuron::Args {
            id: Some(self.neuron_id.into()),
            neuron_id_or_subaccount: None,
            command: Some(manage_neuron::Command::RegisterVote(manage_neuron::RegisterVote {
                proposal: Some(self.proposal_id.into()),
                vote: if self.vote { 1 } else { 2 },
            })),
        };

        ic_cdk::futures::spawn(async move {
            match nns_governance_canister_c2c_client::manage_neuron(self.nns_governance_canister_id, &args).await {
                Ok(response) => match response.command.unwrap() {
                    manage_neuron_response::Command::RegisterVote(_) => {}
                    manage_neuron_response::Command::Error(error) => {
                        error!(?error, "Failed to vote on NNS proposal")
                    }
                    _ => unreachable!(),
                },
                Err(_) => mutate_state(|state| {
                    let now = state.env.now();
                    state
                        .data
                        .timer_jobs
                        .enqueue_job(TimerJob::VoteOnNnsProposal(self), now + MINUTE_IN_MS, now);
                }),
            }
        })
    }
}

impl Job for CheckSnsProposalTallyThenVoteOnNnsProposalJob {
    fn execute(self) {
        ic_cdk::futures::spawn(async move {
            match sns_governance_canister_c2c_client::get_proposal(
                self.sns_governance_canister_id,
                &sns_governance_canister::get_proposal::Args {
                    proposal_id: Some(sns_governance_canister::types::ProposalId {
                        id: self.sns_proposal_id,
                    }),
                },
            )
            .await
            {
                Ok(response) => match response.result.unwrap() {
                    get_proposal_response::Result::Proposal(proposal) => {
                        VoteOnNnsProposalJob {
                            nns_governance_canister_id: self.nns_governance_canister_id,
                            neuron_id: self.nns_neuron_id,
                            proposal_id: self.nns_proposal_id,
                            vote: proposal.latest_tally.is_some_and(|t| t.yes > t.no),
                        }
                        .execute();
                    }
                    get_proposal_response::Result::Error(error) => {
                        error!(
                            ?error,
                            sns_proposal_id = self.sns_proposal_id,
                            "Failed to lookup SNS proposal with linked NNS proposal"
                        )
                    }
                },
                Err(_) => mutate_state(|state| {
                    let now = state.env.now();
                    if now < self.nns_proposal_deadline {
                        state.data.timer_jobs.enqueue_job(
                            TimerJob::CheckSnsProposalTallyThenVoteOnNnsProposal(self),
                            now + (10 * SECOND_IN_MS),
                            now,
                        );
                    }
                }),
            }
        })
    }
}
