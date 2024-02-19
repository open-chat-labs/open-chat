use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use community_canister::c2c_can_access_channel::{Response::*, *};

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_access_channel(args: Args) -> Response {
    read_state(|state| c2c_can_access_channel_impl(args, state))
}

fn c2c_can_access_channel_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        match channel.chat.members.get(&args.user_id).is_some() {
            true => Yes,
            false => No,
        }
    } else {
        ChannelNotFound
    }
}
