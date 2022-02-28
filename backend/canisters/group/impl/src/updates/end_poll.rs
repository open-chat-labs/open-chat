use crate::guards::caller_is_callback_canister;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::EndPollResult;
use group_canister::end_poll::{Response::*, *};
use ic_cdk_macros::update;

#[update(guard = "caller_is_callback_canister")]
#[trace]
async fn end_poll(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| end_poll_impl(args, state))
}

fn end_poll_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    match runtime_state.data.events.end_poll(args.message_index, now) {
        EndPollResult::Success => {
            handle_activity_notification(runtime_state);
            Success
        }
        EndPollResult::PollNotFound => PollNotFound,
        EndPollResult::UnableToEndPoll => UnableToEndPoll,
    }
}
