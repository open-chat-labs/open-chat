use crate::model::nervous_systems::ValidateSubmitProposalPaymentError;
use crate::timer_job_types::{LookupUserThenSubmitProposalJob, ProcessUserRefundJob, SubmitProposalJob, TimerJob};
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use ic_cdk::api::call::CallResult;
use proposals_bot_canister::c2c_submit_proposal::{Response::*, *};
use proposals_bot_canister::{ProposalToSubmit, ProposalToSubmitAction, Treasury};
use sns_governance_canister::types::manage_neuron::Command;
use sns_governance_canister::types::proposal::Action;
use sns_governance_canister::types::{
    ExecuteGenericNervousSystemFunction, ManageNeuronResponse, Motion, Proposal, Subaccount, TransferSnsTreasuryFunds,
    UpgradeSnsControlledCanister, UpgradeSnsToNextVersion, manage_neuron_response,
};
use tracing::{error, info};
use types::{CanisterId, MultiUserChat, SnsNeuronId, UserDetails, UserId, icrc2};
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
        user_id,
        args.governance_canister_id,
        neuron_id,
        proposal,
        args.transaction.ledger,
        args.transaction.amount,
        args.transaction.fee,
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

    let chat_url = chat.chat_url();
    let user_url = format!("{OC_ROOT_URL}user/{user_id}");

    let suffix = format!("\n\n> Submitted by [@{username}]({user_url}) on [OpenChat]({chat_url})");
    proposal.summary.push_str(&suffix);

    proposal
}

pub(crate) async fn lookup_user_then_submit_proposal(
    caller: Principal,
    user_index_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    chat: MultiUserChat,
    governance_canister_id: CanisterId,
    proposal: ProposalToSubmit,
    payment: icrc1::CompletedCryptoTransaction,
) -> Response {
    let UserDetails { user_id, username, .. } = match lookup_user(caller, user_index_canister_id).await {
        Ok(Some(u)) => u,
        Err(LookupUserError::UserNotFound) => unreachable!(),
        Err(LookupUserError::InternalError(error)) => {
            error!(error = error.as_str(), %caller, "Failed to lookup user");
            mutate_state(|state| {
                enqueue_job(
                    TimerJob::LookupUserThenSubmitProposal(LookupUserThenSubmitProposalJob {
                        caller,
                        user_index_canister_id,
                        neuron_id,
                        chat,
                        governance_canister_id,
                        proposal,
                        payment,
                    }),
                    state,
                )
            });
            return Retrying("Failed to lookup user".to_string());
        }
    };

    let proposal = prepare_proposal(proposal, user_id, username, chat);

    submit_user_proposal_and_handle_response(user_id, governance_canister_id, neuron_id, proposal, payment).await
}

pub(crate) async fn submit_user_proposal_and_handle_response(
    user_id: UserId,
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    proposal: ProposalToSubmit,
    ledger_canister_id: CanisterId,
    payment_amount: u128,
    transaction_fee: u128,
) -> Response {
    match submit_proposal(governance_canister_id, neuron_id, proposal.clone()).await {
        Ok(response) => {
            if let Some(command) = response.command {
                match command {
                    manage_neuron_response::Command::MakeProposal(p) => {
                        let proposal_id = p.proposal_id.unwrap().id;
                        mutate_state(|state| {
                            state.data.nervous_systems.record_user_submitted_proposal(
                                governance_canister_id,
                                user_id,
                                proposal_id,
                            )
                        });
                        info!(proposal_id, %user_id, "Proposal submitted");
                        Success
                    }
                    manage_neuron_response::Command::Error(error) => {
                        ProcessUserRefundJob {
                            user_id,
                            ledger_canister_id,
                            amount: payment_amount.saturating_sub(transaction_fee),
                            fee: transaction_fee,
                        }
                        .execute();

                        error!(?error, %user_id, "Failed to submit proposal, refunding user");
                        InternalError(format!("{error:?}"))
                    }
                    _ => unreachable!(),
                }
            } else {
                error!(%user_id, "Failed to submit proposal, response was empty");
                InternalError("Empty response from `manage_neuron`".to_string())
            }
        }
        Err(error) => {
            mutate_state(|state| {
                enqueue_job(
                    TimerJob::SubmitProposal(Box::new(SubmitProposalJob {
                        user_id,
                        governance_canister_id,
                        neuron_id,
                        proposal,
                        ledger: ledger_canister_id,
                        payment_amount,
                        transaction_fee,
                    })),
                    state,
                )
            });
            Retrying(format!("{error:?}"))
        }
    }
}

pub(crate) async fn submit_proposal(
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    proposal: ProposalToSubmit,
) -> CallResult<ManageNeuronResponse> {
    let make_proposal_args = sns_governance_canister::manage_neuron::Args {
        subaccount: neuron_id.to_vec(),
        command: Some(Command::MakeProposal(Proposal {
            title: proposal.title,
            summary: proposal.summary,
            url: proposal.url,
            action: Some(convert_proposal_action(proposal.action)),
        })),
    };

    sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &make_proposal_args).await
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
