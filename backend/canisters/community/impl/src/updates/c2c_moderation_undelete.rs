use crate::guards::caller_is_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_moderation_undelete::*;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

// Restores a message deleted by automated moderation, after a Dismissed verdict on the report
#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_moderation_undelete(args: Args) -> Response {
    execute_update(|state| c2c_moderation_undelete_impl(args, state))
}

fn c2c_moderation_undelete_impl(args: Args, state: &mut RuntimeState) -> UnitResult {
    let now = state.env.now();
    let Some(channel) = state.data.channels.get_mut(&args.channel_id) else {
        return UnitResult::Error(OCErrorCode::ChatNotFound.into());
    };
    channel
        .chat
        .events
        .moderation_undelete(args.thread_root_message_index, args.message_id, now)
        .map(|_| ())
        .into()
}
