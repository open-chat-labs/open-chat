use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::c2c_can_issue_access_token_for_channel::*;
use group_chat_core::{GroupChatCore, GroupMemberInternal};
use types::{AccessTokenType, MessageContentType, VideoCallType};

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token_for_channel(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_for_channel_impl(args, state))
}

fn c2c_can_issue_access_token_for_channel_impl(args: Args, state: &RuntimeState) -> bool {
    let Some(channel) = state.data.channels.get(&args.channel_id) else {
        return false;
    };

    let Some(member) = channel.chat.members.get(&args.user_id) else {
        return false;
    };

    match args.access_type {
        AccessTokenType::StartVideoCallV2(vc) => {
            can_start_video_call(member, state.data.is_public, vc.call_type, &channel.chat)
        }
        AccessTokenType::JoinVideoCall | AccessTokenType::MarkVideoCallAsEnded => true,
        AccessTokenType::BotCommand(c) => channel.chat.members.get_bot(&c.bot).is_some_and(|b| {
            b.role.can_send_message(
                MessageContentType::Text,
                c.thread_root_message_index.is_some(),
                &channel.chat.permissions,
            )
        }),
    }
}

fn can_start_video_call(
    member: &GroupMemberInternal,
    is_public_community: bool,
    call_type: VideoCallType,
    chat: &GroupChatCore,
) -> bool {
    if !member.role.is_permitted(chat.permissions.start_video_call) {
        return false;
    }

    !is_public_community || !chat.is_public.value || matches!(call_type, VideoCallType::Broadcast)
}
