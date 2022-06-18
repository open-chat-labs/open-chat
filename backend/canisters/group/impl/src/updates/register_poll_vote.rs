use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::RegisterPollVoteResult;
use group_canister::register_poll_vote::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
async fn register_poll_vote(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_poll_vote_impl(args, state))
}

fn register_poll_vote_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        let now = runtime_state.env.now();

        let result = runtime_state.data.events.register_poll_vote(
            participant.user_id,
            args.message_index,
            args.poll_option,
            args.operation,
            now,
        );

        match result {
            RegisterPollVoteResult::Success(votes) => {
                handle_activity_notification(runtime_state);
                Success(votes)
            }
            RegisterPollVoteResult::SuccessNoChange(votes) => Success(votes),
            RegisterPollVoteResult::PollEnded => PollEnded,
            RegisterPollVoteResult::PollNotFound => PollNotFound,
            RegisterPollVoteResult::OptionIndexOutOfRange => OptionIndexOutOfRange,
        }
    } else {
        CallerNotInGroup
    }
}
