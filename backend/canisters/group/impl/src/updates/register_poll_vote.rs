use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{RegisterPollVoteArgs, RegisterPollVoteResult};
use group_canister::register_poll_vote::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
async fn register_poll_vote(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_poll_vote_impl(args, state))
}

fn register_poll_vote_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        }

        let now = state.env.now();
        let user_id = member.user_id;
        let min_visible_event_index = member.min_visible_event_index();

        let result = state.data.chat.events.register_poll_vote(RegisterPollVoteArgs {
            user_id,
            min_visible_event_index,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            option_index: args.poll_option,
            operation: args.operation,
            correlation_id: args.correlation_id,
            now,
        });

        match result {
            RegisterPollVoteResult::Success(votes) => {
                handle_activity_notification(state);
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
