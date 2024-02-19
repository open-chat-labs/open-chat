use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use community_canister::c2c_can_issue_access_token_for_channel::{Response::*, *};
use types::AccessTokenType;

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_issue_access_token_for_channel(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_for_channel_impl(args, state))
}

fn c2c_can_issue_access_token_for_channel_impl(args: Args, state: &RuntimeState) -> Response {
    if !args.is_diamond && matches!(args.access_type, AccessTokenType::StartVideoCall) {
        return No;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        match channel.chat.members.get(&args.user_id).is_some() {
            true => Yes,
            false => No,
        }
    } else {
        ChannelNotFound
    }
}
