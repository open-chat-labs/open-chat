use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::RegisterVoteResult;
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
        let user_id = participant.user_id;

        if !runtime_state.data.is_message_accessible_by_index(
            participant.min_visible_event_index(),
            args.thread_root_message_index,
            args.message_index,
        ) {
            return MessageNotFound;
        }

        let chat_events = if let Some(thread_message_index) = args.thread_root_message_index {
            if let Some(thread_events) = runtime_state.data.threads.get_mut(&thread_message_index) {
                thread_events
            } else {
                return MessageNotFound;
            }
        } else {
            &mut runtime_state.data.events
        };

        let result = chat_events.register_poll_vote(user_id, args.message_index, args.poll_option, args.operation, now);

        let latest_event = chat_events.last().index;

        match result {
            RegisterVoteResult::Success(votes) => {
                if let Some(thread_message_index) = args.thread_root_message_index {
                    runtime_state
                        .data
                        .events
                        .update_thread_summary(thread_message_index, user_id, false, latest_event, now);
                }

                handle_activity_notification(runtime_state);
                Success(votes)
            }
            RegisterVoteResult::SuccessNoChange(votes) => Success(votes),
            RegisterVoteResult::PollEnded => PollEnded,
            RegisterVoteResult::PollNotFound => PollNotFound,
            RegisterVoteResult::OptionIndexOutOfRange => OptionIndexOutOfRange,
        }
    } else {
        CallerNotInGroup
    }
}
