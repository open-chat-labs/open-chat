use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use group_canister::c2c_can_issue_access_token::*;
use group_chat_core::{GroupChatCore, GroupMemberInternal};
use types::{AccessTokenType, VideoCallType};

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args: Args, state: &RuntimeState) -> bool {
    let Some(member) = state.data.chat.members.get(&args.user_id) else {
        return false;
    };

    match args.access_type {
        AccessTokenType::StartVideoCall => {
            can_start_video_call(member, args.is_diamond, VideoCallType::Default, &state.data.chat)
        }
        AccessTokenType::StartVideoCallV2(vc) => can_start_video_call(member, args.is_diamond, vc.call_type, &state.data.chat),
        AccessTokenType::JoinVideoCall | AccessTokenType::MarkVideoCallAsEnded => true,
    }
}

fn can_start_video_call(
    member: &GroupMemberInternal,
    is_diamond: bool,
    call_type: VideoCallType,
    chat: &GroupChatCore,
) -> bool {
    if !is_diamond || !member.role.is_permitted(chat.permissions.start_video_call) {
        return false;
    }

    !chat.is_public.value || matches!(call_type, VideoCallType::Broadcast)
}
