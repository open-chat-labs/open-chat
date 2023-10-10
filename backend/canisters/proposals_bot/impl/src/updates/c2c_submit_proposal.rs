use crate::timer_job_types::{SubmitProposalJob, TimerJob};
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use proposals_bot_canister::c2c_submit_proposal::{Response::*, *};
use proposals_bot_canister::{ProposalToSubmit, ProposalToSubmitAction, Treasury};
use sns_governance_canister::types::manage_neuron::Command;
use sns_governance_canister::types::proposal::Action;
use sns_governance_canister::types::{manage_neuron_response, Motion, Proposal, Subaccount, TransferSnsTreasuryFunds};
use tracing::{error, info};
use types::{CanisterId, MultiUserChat, SnsNeuronId, UserDetails, UserId};
use user_index_canister_c2c_client::{lookup_user, LookupUserError};
use utils::time::SECOND_IN_MS;

const OC_ROOT_URL: &str = "https://oc.app/";

#[update_msgpack]
#[trace]
async fn c2c_submit_proposal(args: Args) -> Response {
    let PrepareResult {
        caller,
        user_index_canister_id,
        neuron_id,
        chat,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let UserDetails { user_id, username, .. } = match lookup_user(caller, user_index_canister_id).await {
        Ok(u) => u,
        Err(LookupUserError::UserNotFound) => unreachable!(),
        Err(LookupUserError::InternalError(error)) => {
            error!(error = error.as_str(), %caller, "Failed to lookup user");
            return InternalError(error);
        }
    };

    let proposal = prepare_proposal(args.proposal, user_id, username, chat);

    submit_proposal(user_id, args.governance_canister_id, neuron_id, proposal).await
}

struct PrepareResult {
    caller: Principal,
    user_index_canister_id: CanisterId,
    neuron_id: SnsNeuronId,
    chat: MultiUserChat,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(neuron_id) = state
        .data
        .nervous_systems
        .get_neuron_id_for_submitting_proposals(&args.governance_canister_id)
    {
        Ok(PrepareResult {
            caller: state.env.caller(),
            user_index_canister_id: state.data.user_index_canister_id,
            neuron_id,
            chat: state.data.nervous_systems.get_chat_id(&args.governance_canister_id).unwrap(),
        })
    } else {
        Err(GovernanceCanisterNotSupported)
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
                        error!(?error, %user_id, "Failed to submit proposal");
                        InternalError(format!("{error:?}"))
                    }
                    _ => unreachable!(),
                };
            }
            error!(%user_id, "Failed to submit proposal, response was empty");
            InternalError("Empty response from `manage_neuron`".to_string())
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
