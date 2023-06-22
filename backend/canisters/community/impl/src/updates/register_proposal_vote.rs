use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, Reader, RecordProposalVoteResult};
use community_canister::register_proposal_vote::{Response::*, *};
use ic_cdk_macros::update;
use types::{CanisterId, ChannelId, ProposalId, UserId};

#[update]
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
        Err(response) => return response,
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
                mutate_state(|state| commit(args.channel_id, user_id, args, state));
                Success
            }
            user_canister::c2c_vote_on_proposal::Response::NoEligibleNeurons => NoEligibleNeurons,
            user_canister::c2c_vote_on_proposal::Response::ProposalNotFound => ProposalNotFound,
            user_canister::c2c_vote_on_proposal::Response::ProposalNotAcceptingVotes => ProposalNotAcceptingVotes,
            user_canister::c2c_vote_on_proposal::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareResult {
    user_id: UserId,
    is_nns: bool,
    governance_canister_id: CanisterId,
    proposal_id: ProposalId,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();

    let member = match state.data.members.get(caller) {
        Some(p) => p,
        None => return Err(UserNotInCommunity),
    };

    if member.suspended.value {
        return Err(UserSuspended);
    }

    let channel = match state.data.channels.get(&args.channel_id) {
        Some(c) => c,
        None => return Err(ChannelNotFound),
    };

    let channel_member = match channel.chat.members.get(&member.user_id) {
        Some(m) => m,
        None => return Err(UserNotInChannel),
    };

    let min_visible_event_index = channel_member.min_visible_event_index();
    let now = state.env.now();

    if let Some(proposal) = channel
        .chat
        .events
        .visible_main_events_reader(min_visible_event_index, now)
        .message_internal(args.message_index.into())
        .and_then(|m| if let MessageContentInternal::GovernanceProposal(p) = &m.content { Some(p) } else { None })
    {
        if let Some(vote) = proposal.votes.get(&member.user_id) {
            Err(AlreadyVoted(*vote))
        } else {
            Ok(PrepareResult {
                user_id: member.user_id,
                is_nns: proposal.proposal.is_nns(),
                governance_canister_id: proposal.governance_canister_id,
                proposal_id: proposal.proposal.id(),
            })
        }
    } else {
        Err(ProposalMessageNotFound)
    }
}

fn commit(channel_id: ChannelId, user_id: UserId, args: Args, state: &mut RuntimeState) -> Response {
    let channel = match state.data.channels.get_mut(&channel_id) {
        Some(c) => c,
        None => return ChannelNotFound,
    };

    let member = match channel.chat.members.get_mut(&user_id) {
        Some(m) => m,
        None => return UserNotInChannel,
    };

    let now = state.env.now();
    let min_visible_event_index = member.min_visible_event_index();

    match channel
        .chat
        .events
        .record_proposal_vote(user_id, min_visible_event_index, args.message_index, args.adopt, now)
    {
        RecordProposalVoteResult::Success => {
            let votes = member.proposal_votes.entry(now).or_default();
            if !votes.contains(&args.message_index) {
                votes.push(args.message_index);
            }
            handle_activity_notification(state);
            Success
        }
        RecordProposalVoteResult::AlreadyVoted(vote) => AlreadyVoted(vote),
        RecordProposalVoteResult::ProposalNotFound => ProposalNotFound,
    }
}
