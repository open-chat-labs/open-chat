use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::deleted_message::{Response::*, *};
use group_chat_core::DeletedMessageResult;

#[query(msgpack = true)]
fn deleted_message(args: Args) -> Response {
    read_state(|state| deleted_message_impl(args, state))
}

fn deleted_message_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        let user_id = member.user_id;

        if let Some(channel) = state.data.channels.get(&args.channel_id) {
            match channel
                .chat
                .deleted_message(user_id, args.thread_root_message_index, args.message_id)
            {
                DeletedMessageResult::Success(content) => Success(SuccessResult { content: *content }),
                DeletedMessageResult::UserNotInGroup => UserNotInChannel,
                DeletedMessageResult::NotAuthorized => NotAuthorized,
                DeletedMessageResult::MessageNotFound => MessageNotFound,
                DeletedMessageResult::MessageHardDeleted => MessageHardDeleted,
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}
