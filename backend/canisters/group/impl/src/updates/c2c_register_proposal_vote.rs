use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::RegisterProposalVoteResult;
use group_canister::c2c_register_proposal_vote::{Response::*, *};

#[update_msgpack]
#[trace]
fn c2c_register_proposal_vote(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_register_proposal_vote_impl(args, state))
}

fn c2c_register_proposal_vote_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller().into();
    let now = runtime_state.env.now();

    if runtime_state.data.participants.get_by_user_id(&caller).is_none() {
        return CallerNotInGroup;
    }

    match runtime_state
        .data
        .events
        .register_proposal_vote(caller, args.message_id, args.adopt, now)
    {
        RegisterProposalVoteResult::Success(r) => {
            handle_activity_notification(runtime_state);
            Success(SuccessResult {
                adopt_votes: r.adopt_votes,
                reject_votes: r.reject_votes,
                my_vote: args.adopt,
                latest_event_index: runtime_state.data.events.last().index,
            })
        }
        RegisterProposalVoteResult::AlreadyVoted(r) => AlreadyVoted(SuccessResult {
            adopt_votes: r.adopt_votes,
            reject_votes: r.reject_votes,
            my_vote: args.adopt,
            latest_event_index: runtime_state.data.events.last().index,
        }),
        RegisterProposalVoteResult::ProposalNotFound => ProposalNotFound,
    }
}
