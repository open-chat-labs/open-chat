use crate::guards::caller_is_callback_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::EndPollResult;
use user_canister::c2c_end_poll::{Response::*, *};

#[update_msgpack(guard = "caller_is_callback_canister")]
#[trace]
async fn c2c_end_poll(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_end_poll_impl(args, state))
}

fn c2c_end_poll_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = runtime_state.env.now();

        match chat.events.end_poll(None, args.message_index, args.correlation_id, now) {
            EndPollResult::Success => Success,
            EndPollResult::PollNotFound => PollNotFound,
            EndPollResult::UnableToEndPoll => UnableToEndPoll,
        }
    } else {
        ChatNotFound
    }
}
