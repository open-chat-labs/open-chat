use crate::guards::caller_is_callback_canister;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::EndPollResult;
use group_canister::c2c_end_poll::{Response::*, *};

#[update_msgpack(guard = "caller_is_callback_canister")]
#[trace]
async fn c2c_end_poll(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_end_poll_impl(args, state))
}

fn c2c_end_poll_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    let chat_events = if let Some(thread_message_index) = args.thread_root_message_index {
        if let Some(thread_events) = runtime_state.data.threads.get_mut(&thread_message_index) {
            thread_events
        } else {
            return PollNotFound;
        }
    } else {
        &mut runtime_state.data.events
    };

    match chat_events.end_poll(args.message_index, now) {
        EndPollResult::Success => {
            handle_activity_notification(runtime_state);
            Success
        }
        EndPollResult::PollNotFound => PollNotFound,
        EndPollResult::UnableToEndPoll => UnableToEndPoll,
    }
}
