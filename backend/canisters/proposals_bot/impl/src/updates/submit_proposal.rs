use crate::model::nervous_systems::ValidateSubmitProposalPaymentError;
use crate::timer_job_types::{
    CheckSnsProposalTallyThenVoteOnNnsProposalJob, ProcessUserRefundJob, SubmitProposalJob, TimerJob,
};
use crate::{RuntimeState, UserIdAndPayment, mutate_state, read_state};
use candid::{Deserialize, Principal};
use canister_api_macros::update;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use constants::{MINUTE_IN_MS, SECOND_IN_MS};
use ledger_utils::icrc2::process_transaction;
use proposals_bot_canister::submit_proposal::{Response::*, *};
use proposals_bot_canister::{ProposalToSubmit, ProposalToSubmitAction, Treasury};
use serde::Serialize;
use sns_governance_canister::types::manage_neuron::Command;
use sns_governance_canister::types::proposal::Action;
use sns_governance_canister::types::{
    AdvanceSnsTargetVersion, ExecuteGenericNervousSystemFunction, MintSnsTokens, Motion, Proposal, Subaccount,
    TransferSnsTreasuryFunds, UpgradeSnsControlledCanister, UpgradeSnsToNextVersion, manage_neuron_response,
};
use tracing::{error, info};
use types::{CanisterId, MultiUserChat, NnsNeuronId, SnsNeuronId, TimestampMillis, UserDetails, UserId, icrc2};
use user_index_canister_c2c_client::lookup_user;

const OC_ROOT_URL: &str = "https://oc.app/";

#[update(msgpack = true)]
#[trace]
async fn submit_proposal(args: Args) -> Response {
    let governance_canister_id = args.governance_canister_id;
    let response = submit_proposal_impl(args).await;

    if !matches!(response, Success) {
        error!(%governance_canister_id, ?response, "User failed to submit proposal");
    }

    response
}

async fn submit_proposal_impl(args: Args) -> Response {
    let PrepareResult {
        caller,
        this_canister_id,
        user_index_canister_id,
        neuron_id,
        chat,
    } = match read_state(|state| prepare(args.governance_canister_id, &args.transaction, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let UserDetails { user_id, username, .. } = match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(u)) => u,
        Ok(_) => panic!("User not found"),
        Err(error) => return InternalError(format!("Failed to lookup user: {error:?}")),
    };

    match process_transaction(args.transaction.clone(), this_canister_id).await {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => return PaymentFailed(error.error_message),
        Err(error) => return InternalError(format!("{error:?}")),
    }

    let proposal = prepare_proposal(args.proposal, user_id, username, chat);

    submit_proposal(
        Some(UserIdAndPayment {
            user_id,
            ledger_canister_id: args.transaction.ledger,
            amount: args.transaction.amount,
            fee: args.transaction.fee,
        }),
        args.governance_canister_id,
        neuron_id,
        proposal,
        None,
    )
    .await
}

struct PrepareResult {
    caller: Principal,
    this_canister_id: CanisterId,
    user_index_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    chat: MultiUserChat,
}

fn prepare(
    governance_canister_id: CanisterId,
    transaction: &icrc2::PendingCryptoTransaction,
    state: &RuntimeState,
) -> Result<PrepareResult, Response> {
    use ValidateSubmitProposalPaymentError as E;
    match state.data.nervous_systems.validate_submit_proposal_payment(
        &governance_canister_id,
        transaction.ledger,
        transaction.amount,
    ) {
        Ok(neuron_id) => Ok(PrepareResult {
            caller: state.env.caller(),
            this_canister_id: state.env.canister_id(),
            user_index_canister_id: state.data.user_index_canister_id,
            neuron_id,
            chat: state.data.nervous_systems.get_chat_id(&governance_canister_id).unwrap(),
        }),
        Err(E::GovernanceCanisterNotSupported | E::IncorrectLedger) => Err(GovernanceCanisterNotSupported),
        Err(E::InsufficientPayment(min)) => Err(InsufficientPayment(min.into())),
    }
}

fn prepare_proposal(
    mut proposal: ProposalToSubmit,
    user_id: UserId,
    username: String,
    chat: MultiUserChat,
) -> ProposalToSubmit {
    proposal.title = proposal.title.trim().to_string();
    proposal.summary = proposal.summary.trim().to_string();
    proposal.url = proposal.url.trim().to_string();

    let chat_url = match chat {
        MultiUserChat::Group(group_id) => format!("{OC_ROOT_URL}group/{group_id}"),
        MultiUserChat::Channel(community_id, channel_id) => {
            format!("{OC_ROOT_URL}community/{community_id}/channel/{channel_id}")
        }
    };
    let user_url = format!("{OC_ROOT_URL}user/{user_id}");

    let suffix = format!("\n\n> Submitted by [@{username}]({user_url}) on [OpenChat]({chat_url})");
    proposal.summary.push_str(&suffix);

    proposal
}

pub(crate) async fn submit_proposal(
    user_id_and_payment: Option<UserIdAndPayment>,
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    proposal: ProposalToSubmit,
    linked_nns_proposal: Option<LinkedNnsProposal>,
) -> Response {
    let make_proposal_args = sns_governance_canister::manage_neuron::Args {
        subaccount: neuron_id.to_vec(),
        command: Some(Command::MakeProposal(Proposal {
            title: proposal.title.clone(),
            summary: proposal.summary.clone(),
            url: proposal.url.clone(),
            action: Some(convert_proposal_action(proposal.action.clone())),
        })),
    };
    let user_id = user_id_and_payment.as_ref().map(|u| u.user_id);
    let user_id_string = user_id.map_or("none".to_string(), |id| id.to_string());
    match sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &make_proposal_args).await {
        Ok(response) => {
            if let Some(command) = response.command {
                return match command {
                    manage_neuron_response::Command::MakeProposal(p) => {
                        let proposal_id = p.proposal_id.unwrap().id;
                        mutate_state(|state| {
                            if let Some(user_id) = user_id {
                                state.data.nervous_systems.record_user_submitted_proposal(
                                    governance_canister_id,
                                    user_id,
                                    proposal_id,
                                )
                            }
                            if let Some(nns_proposal) = linked_nns_proposal {
                                let now = state.env.now();
                                state.data.timer_jobs.enqueue_job(
                                    TimerJob::CheckSnsProposalTallyThenVoteOnNnsProposal(
                                        CheckSnsProposalTallyThenVoteOnNnsProposalJob {
                                            sns_governance_canister_id: governance_canister_id,
                                            sns_proposal_id: proposal_id,
                                            nns_governance_canister_id: nns_proposal.nns_governance_canister_id,
                                            nns_neuron_id: nns_proposal.nns_neuron_id,
                                            nns_proposal_id: nns_proposal.proposal_id,
                                            nns_proposal_deadline: nns_proposal.deadline,
                                        },
                                    ),
                                    nns_proposal.deadline.saturating_sub(10 * MINUTE_IN_MS),
                                    now,
                                )
                            }
                        });
                        info!(proposal_id, user_id = user_id_string, %governance_canister_id, "Proposal submitted");
                        Success
                    }
                    manage_neuron_response::Command::Error(error) => {
                        if let Some(user_and_payment) = user_id_and_payment {
                            ProcessUserRefundJob {
                                user_id: user_and_payment.user_id,
                                ledger_canister_id: user_and_payment.ledger_canister_id,
                                amount: user_and_payment.amount.saturating_sub(user_and_payment.fee),
                                fee: user_and_payment.fee,
                            }
                            .execute();

                            error!(?error, user_id = user_id_string, "Failed to submit proposal, refunding user");
                        }
                        InternalError(format!("{error:?}"))
                    }
                    _ => unreachable!(),
                };
            }
            error!(user_id = user_id_string, "Failed to submit proposal, response was empty");
            InternalError("Empty response from `manage_neuron`".to_string())
        }
        Err(error) => {
            mutate_state(|state| {
                enqueue_job(
                    TimerJob::SubmitProposal(Box::new(SubmitProposalJob {
                        governance_canister_id,
                        neuron_id,
                        proposal,
                        user_id_and_payment,
                        linked_nns_proposal,
                    })),
                    state,
                )
            });
            Retrying(format!("{error:?}"))
        }
    }
}

fn convert_proposal_action(action: ProposalToSubmitAction) -> Action {
    match action {
        ProposalToSubmitAction::Motion => Action::Motion(Motion {
            motion_text: "".to_string(),
        }),
        ProposalToSubmitAction::TransferSnsTreasuryFunds(t) => Action::TransferSnsTreasuryFunds(TransferSnsTreasuryFunds {
            from_treasury: match t.treasury {
                Treasury::ICP => 1,
                Treasury::SNS => 2,
            },
            amount_e8s: t.amount.try_into().unwrap(),
            memo: t.memo,
            to_principal: Some(t.to.owner),
            to_subaccount: t.to.subaccount.map(|sa| Subaccount { subaccount: sa.to_vec() }),
        }),
        ProposalToSubmitAction::MintSnsTokens(t) => Action::MintSnsTokens(MintSnsTokens {
            amount_e8s: Some(t.amount.try_into().unwrap()),
            memo: t.memo,
            to_principal: Some(t.to.owner),
            to_subaccount: t.to.subaccount.map(|sa| Subaccount { subaccount: sa.to_vec() }),
        }),
        ProposalToSubmitAction::UpgradeSnsToNextVersion => Action::UpgradeSnsToNextVersion(UpgradeSnsToNextVersion {}),
        ProposalToSubmitAction::AdvanceSnsTargetVersion => {
            Action::AdvanceSnsTargetVersion(AdvanceSnsTargetVersion { new_target: None })
        }
        ProposalToSubmitAction::UpgradeSnsControlledCanister(u) => {
            Action::UpgradeSnsControlledCanister(UpgradeSnsControlledCanister {
                canister_id: Some(u.canister_id),
                new_canister_wasm: u.new_canister_wasm,
                mode: Some(u.mode.into()),
                canister_upgrade_arg: None,
            })
        }
        ProposalToSubmitAction::ExecuteGenericNervousSystemFunction(e) => {
            Action::ExecuteGenericNervousSystemFunction(ExecuteGenericNervousSystemFunction {
                function_id: e.function_id,
                payload: e.payload,
            })
        }
    }
}

fn enqueue_job(job: TimerJob, state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.timer_jobs.enqueue_job(job, now + (10 * SECOND_IN_MS), now)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LinkedNnsProposal {
    pub nns_governance_canister_id: CanisterId,
    pub nns_neuron_id: NnsNeuronId,
    pub proposal_id: u64,
    pub deadline: TimestampMillis,
}
