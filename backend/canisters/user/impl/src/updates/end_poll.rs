use crate::guards::caller_is_callback_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::EndPollResult;
use ic_cdk_macros::update;
use user_canister::end_poll::{Response::*, *};

#[update(guard = "caller_is_callback_canister")]
#[trace]
async fn end_poll(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| end_poll_impl(args, state))
}

fn end_poll_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let now = runtime_state.env.now();

        match chat.events.end_poll(args.message_index, now) {
            EndPollResult::Success => Success,
            EndPollResult::PollNotFound => PollNotFound,
            EndPollResult::UnableToEndPoll => UnableToEndPoll,
        }
    } else {
        ChatNotFound
    }
}
