use crate::guards::caller_is_group_or_community_canister;
use crate::{RuntimeState, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_csam_detected::*;
use types::Chat;

#[update(guard = "caller_is_group_or_community_canister", msgpack = true)]
#[trace]
fn c2c_csam_detected(args: Args) -> Response {
    read_state(|state| c2c_csam_detected_impl(args, state))
}

fn c2c_csam_detected_impl(args: Args, state: &RuntimeState) -> Response {
    // The chat id is derived from the (verified) caller rather than trusted from the args
    let caller = state.env.caller();
    let chat_id = if state.is_caller_community_canister() {
        let Some(channel_id) = args.channel_id else {
            return Response::Error(oc_error_codes::OCErrorCode::InvalidRequest.into());
        };
        Chat::Channel(caller.into(), channel_id)
    } else {
        Chat::Group(caller.into())
    };

    state.data.fire_and_forget_handler.send(
        state.data.user_index_canister_id,
        "c2c_csam_detected_msgpack".to_string(),
        msgpack::serialize_then_unwrap(user_index_canister::c2c_csam_detected::Args {
            chat_id,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            message_id: args.message_id,
            sender: args.sender,
            flags: args.flags,
            content_excerpt: args.content_excerpt,
        }),
    );

    Response::Success
}
