use crate::guards::caller_is_video_call_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::video_call_declined::*;

// A decline, relayed by the video bridge (#9534). The only effect is a `declined_elsewhere`
// dismissal to the named user's phones; nobody else learns of it.
#[update(guard = "caller_is_video_call_operator", candid = true, msgpack = true)]
#[trace]
fn video_call_declined(args: Args) -> Response {
    mutate_state(|state| video_call_declined_impl(args, state))
}

fn video_call_declined_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    state.push_call_declined(args.user_id, args.chat_id, args.message_id, now);
    Response::Success
}
