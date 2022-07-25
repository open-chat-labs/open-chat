use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::RecordProposalVoteResult;
use group_canister::c2c_record_proposal_vote::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_record_proposal_vote(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_record_proposal_vote_impl(args, state))
}

fn c2c_record_proposal_vote_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller().into();

    let participant = match runtime_state.data.participants.get_by_user_id_mut(&caller) {
        Some(p) => p,
        None => return CallerNotInGroup,
    };

    match runtime_state
        .data
        .events
        .record_proposal_vote(participant.user_id, args.message_index, args.adopt)
    {
        RecordProposalVoteResult::Success => {
            let now = runtime_state.env.now();
            participant.proposal_votes.entry(now).or_default().insert(args.message_index);
            handle_activity_notification(runtime_state);
            Success
        }
        RecordProposalVoteResult::AlreadyVoted(vote) => AlreadyVoted(vote),
        RecordProposalVoteResult::ProposalNotFound => ProposalNotFound,
    }
}
