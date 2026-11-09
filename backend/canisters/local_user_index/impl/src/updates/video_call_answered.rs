use crate::guards::caller_is_video_call_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::video_call_answered::*;
use types::CallDismissalKind;

// An answer from an iPhone with no web layer running, relayed by the video bridge (#10398). The
// only effect is an `answered_elsewhere` dismissal to the named user's other phones.
#[update(guard = "caller_is_video_call_operator", candid = true, msgpack = true)]
#[trace]
fn video_call_answered(args: Args) -> Response {
    mutate_state(|state| video_call_answered_impl(args, state))
}

fn video_call_answered_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.push_call_dismissed(
        args.user_id,
        args.chat_id,
        args.message_id,
        CallDismissalKind::AnsweredElsewhere,
        now,
    );
    Response::Success
}
