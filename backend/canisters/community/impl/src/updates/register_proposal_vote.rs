use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, Reader};
use community_canister::register_proposal_vote::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, ChannelId, OCResult, ProposalId, UserId};

#[update(msgpack = true)]
#[trace]
async fn register_proposal_vote(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        user_id,
        is_nns,
        governance_canister_id,
        proposal_id,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let c2c_args = user_canister::c2c_vote_on_proposal::Args {
        is_nns,
        governance_canister_id,
        proposal_id,
        adopt: args.adopt,
    };
    match user_canister_c2c_client::c2c_vote_on_proposal(user_id.into(), &c2c_args).await {
        Ok(response) => match response {
            user_canister::c2c_vote_on_proposal::Response::Success => {
                if let Err(error) = mutate_state(|state| commit(args.channel_id, user_id, args, state)) {
                    Error(error)
                } else {
                    Success
                }
            }
            response => Error(OCErrorCode::Unknown.with_json(&response)),
        },
        Err(error) => Error(error.into()),
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
    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let channel_member = channel.chat.members.get_verified_member(member.user_id)?;
    let min_visible_event_index = channel_member.min_visible_event_index();

    if let Some(proposal) = channel
        .chat
        .events
        .visible_main_events_reader(min_visible_event_index)
        .message_internal(args.message_index.into())
        .and_then(|m| if let MessageContentInternal::GovernanceProposal(p) = m.content { Some(p) } else { None })
    {
        if proposal.votes.contains_key(&member.user_id) {
            Err(OCErrorCode::NoChange.into())
        } else {
            Ok(PrepareResult {
                user_id: member.user_id,
                is_nns: proposal.proposal.is_nns(),
                governance_canister_id: proposal.governance_canister_id,
                proposal_id: proposal.proposal.id(),
            })
        }
    } else {
        Err(OCErrorCode::MessageNotFound.into())
    }
}

fn commit(channel_id: ChannelId, user_id: UserId, args: Args, state: &mut RuntimeState) -> OCResult {
    let channel = state.data.channels.get_mut_or_err(&channel_id)?;
    let member = channel.chat.members.get_verified_member(user_id)?;
    let min_visible_event_index = member.min_visible_event_index();

    channel
        .chat
        .events
        .record_proposal_vote(user_id, min_visible_event_index, args.message_index, args.adopt)?;

    let now = state.env.now();
    channel.chat.members.register_proposal_vote(&user_id, args.message_index, now);

    handle_activity_notification(state);
    Ok(())
}
