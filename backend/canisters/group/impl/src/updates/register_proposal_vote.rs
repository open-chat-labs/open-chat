use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, Reader};
use group_canister::register_proposal_vote::*;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, EventIndex, OCResult, ProposalId, UserId};

#[update(msgpack = true)]
#[trace]
async fn register_proposal_vote(args: Args) -> Response {
    execute_update_async(|| register_proposal_vote_impl(args)).await
}

async fn register_proposal_vote_impl(args: Args) -> Response {
    let PrepareResult {
        user_id,
        is_nns,
        governance_canister_id,
        proposal_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    let c2c_args = user_canister::c2c_vote_on_proposal::Args {
        is_nns,
        governance_canister_id,
        proposal_id,
        adopt: args.adopt,
    };
    match user_canister_c2c_client::c2c_vote_on_proposal(user_id.into(), &c2c_args).await {
        Ok(response) => match response {
            user_canister::c2c_vote_on_proposal::Response::Success => mutate_state(|state| commit(user_id, args, state)).into(),
            user_canister::c2c_vote_on_proposal::Response::Error(error) => Response::Error(error),
            response => Response::Error(OCErrorCode::Unknown.with_json(&response)),
        },
        Err(error) => Response::Error(error.into()),
    }
}

struct PrepareResult {
    user_id: UserId,
    is_nns: bool,
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    let min_visible_event_index = member.min_visible_event_index();

    if let Some(proposal) = state
        .data
        .chat
        .events
        .visible_main_events_reader(min_visible_event_index)
        .message_internal(args.message_index.into())
        .and_then(|m| if let MessageContentInternal::GovernanceProposal(p) = m.content { Some(p) } else { None })
    {
        if proposal.votes.contains_key(&member.user_id()) {
            Err(OCErrorCode::NoChange.into())
        } else {
            Ok(PrepareResult {
                user_id: member.user_id(),
                is_nns: proposal.proposal.is_nns(),
                governance_canister_id: proposal.governance_canister_id,
                proposal_id: proposal.proposal.id(),
            })
        }
    } else {
        Err(OCErrorCode::MessageNotFound.into())
    }
}

fn commit(user_id: UserId, args: Args, state: &mut RuntimeState) -> OCResult {
    state
        .data
        .chat
        .events
        .record_proposal_vote(user_id, EventIndex::default(), args.message_index, args.adopt)?;

    state
        .data
        .chat
        .members
        .register_proposal_vote(&user_id, args.message_index, state.env.now());

    handle_activity_notification(state);
    Ok(())
}
