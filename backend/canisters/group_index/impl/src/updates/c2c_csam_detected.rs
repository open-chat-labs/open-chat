use crate::guards::caller_is_group_or_community_canister;
use crate::read_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_index_canister::c2c_csam_detected::*;
use types::{CanisterId, Chat};

#[update(guard = "caller_is_group_or_community_canister", msgpack = true)]
#[trace]
async fn c2c_csam_detected(args: Args) -> Response {
    let PrepareResult {
        chat_id,
        user_index_canister_id,
    } = match read_state(|state| prepare(&args, state)) {
        Some(result) => result,
        None => return Response::Error(oc_error_codes::OCErrorCode::InvalidRequest.into()),
    };

    let c2c_args = user_index_canister::c2c_csam_detected::Args {
        chat_id,
        thread_root_message_index: args.thread_root_message_index,
        message_index: args.message_index,
        message_id: args.message_id,
        sender: args.sender,
        flags: args.flags,
        content_excerpt: args.content_excerpt,
    };

    match user_index_canister_c2c_client::c2c_csam_detected(user_index_canister_id, &c2c_args).await {
        Ok(_) => Response::Success,
        Err(error) => Response::Error(error.into()),
    }
}

struct PrepareResult {
    chat_id: Chat,
    user_index_canister_id: CanisterId,
}

fn prepare(args: &Args, state: &crate::RuntimeState) -> Option<PrepareResult> {
    // The chat id is derived from the (verified) caller rather than trusted from the args
    let caller = state.env.caller();
    let chat_id = if state.is_caller_community_canister() {
        Chat::Channel(caller.into(), args.channel_id?)
    } else {
        Chat::Group(caller.into())
    };

    Some(PrepareResult {
        chat_id,
        user_index_canister_id: state.data.user_index_canister_id,
    })
}
