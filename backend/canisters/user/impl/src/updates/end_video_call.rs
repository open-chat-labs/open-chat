use crate::guards::caller_is_video_call_operator;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::EndVideoCallResult;
use ic_cdk_macros::update;
use user_canister::end_video_call::{Response::*, *};

#[update(guard = "caller_is_video_call_operator")]
#[trace]
fn end_video_call(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| end_video_call_impl(args, state))
}

fn end_video_call_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        match chat.events.end_video_call(args.message_id.into(), state.env.now()) {
            EndVideoCallResult::Success => Success,
            EndVideoCallResult::MessageNotFound => MessageNotFound,
            EndVideoCallResult::AlreadyEnded => AlreadyEnded,
        }
    } else {
        MessageNotFound
    }
}
