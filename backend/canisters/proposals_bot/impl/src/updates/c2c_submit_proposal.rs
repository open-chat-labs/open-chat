use crate::timer_job_types::{SubmitProposalJob, TimerJob};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister_c2c_client::{lookup_user, LookupUserError};
use proposals_bot_canister::c2c_submit_proposal::{Response::*, *};
use proposals_bot_canister::{ProposalToSubmit, ProposalToSubmitAction, Treasury};
use sns_governance_canister::types::manage_neuron::Command;
use sns_governance_canister::types::proposal::Action;
use sns_governance_canister::types::{manage_neuron_response, Motion, Proposal, Subaccount, TransferSnsTreasuryFunds};
use types::{CanisterId, SnsNeuronId, UserId};
use utils::time::SECOND_IN_MS;

#[update_msgpack]
#[trace]
async fn c2c_submit_proposal(args: Args) -> Response {
    let PrepareResult {
        caller,
        local_user_index_canister_id,
        neuron_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let user_id = match lookup_user(caller, local_user_index_canister_id).await {
        Ok(u) => u.user_id,
        Err(LookupUserError::UserNotFound) => unreachable!(),
        Err(LookupUserError::InternalError(error)) => return InternalError(error),
    };

    submit_proposal(user_id, args.governance_canister_id, neuron_id, args.proposal).await
}

struct PrepareResult {
    caller: Principal,
    local_user_index_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(neuron_id) = state
        .data
        .nervous_systems
        .get_neuron_id_for_submitting_proposals(&args.governance_canister_id)
    {
        Ok(PrepareResult {
            caller: state.env.caller(),
            local_user_index_canister_id: state.data.local_user_index_canister_id,
            neuron_id,
        })
    } else {
        Err(GovernanceCanisterNotSupported)
    }
}

pub(crate) async fn submit_proposal(
    user_id: UserId,
    governance_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    proposal: ProposalToSubmit,
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
    match sns_governance_canister_c2c_client::manage_neuron(governance_canister_id, &make_proposal_args).await {
        Ok(response) => {
            if let Some(command) = response.command {
                return match command {
                    manage_neuron_response::Command::MakeProposal(p) => {
                        mutate_state(|state| {
                            state.data.nervous_systems.record_user_submitted_proposal(
                                governance_canister_id,
                                user_id,
                                p.proposal_id.unwrap().id,
                            )
                        });
                        Success
                    }
                    manage_neuron_response::Command::Error(error) => InternalError(format!("{error:?}")),
                    _ => unreachable!(),
                };
            }
            InternalError("Response command was empty".to_string())
        }
        Err(error) => {
            mutate_state(|state| {
                let now = state.env.now();
                state.data.timer_jobs.enqueue_job(
                    TimerJob::SubmitProposal(SubmitProposalJob {
                        user_id,
                        governance_canister_id,
                        neuron_id,
                        proposal,
                    }),
                    now + (10 * SECOND_IN_MS),
                    now,
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
    }
}
