use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::c2c_can_issue_access_token::*;
use group_chat_core::{GroupChatCore, GroupRoleInternal};
use types::{CheckAccessTokenType, MessageContentType, VideoCallType};

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args: Args, state: &RuntimeState) -> bool {
    let Ok(member) = state.data.chat.members.get_verified_member(args.user_id) else {
        return false;
    };

    match args.access_type {
        CheckAccessTokenType::StartVideoCallV2(vc) => can_start_video_call(member.role(), vc.call_type, &state.data.chat),
        CheckAccessTokenType::JoinVideoCall | CheckAccessTokenType::MarkVideoCallAsEnded => true,
        CheckAccessTokenType::BotCommand(c) => state.data.chat.members.get_bot(&c.bot).is_some_and(|b| {
            b.role().can_send_message(
                MessageContentType::Text,
                c.thread_root_message_index.is_some(),
                &state.data.chat.permissions,
            )
        }),
    }
}

fn can_start_video_call(member_role: GroupRoleInternal, call_type: VideoCallType, chat: &GroupChatCore) -> bool {
    if !member_role.is_permitted(chat.permissions.start_video_call) {
        return false;
    }

    !chat.is_public.value || matches!(call_type, VideoCallType::Broadcast)
}
