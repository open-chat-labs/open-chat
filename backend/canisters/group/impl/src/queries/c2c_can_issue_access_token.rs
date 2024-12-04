use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::c2c_can_issue_access_token::*;
use group_chat_core::{GroupChatCore, GroupRoleInternal};
use types::{CheckAccessTokenType, VideoCallType};
use utils::bots::can_execute_bot_command;

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
        CheckAccessTokenType::BotCommand(c) => {
            // Get the permissions granted to the bot in this group
            let Some(granted_to_bot) = state.data.get_bot_permissions(&c.bot) else {
                return false;
            };

            // Get the permissions granted to the user in this group
            let Some(granted_to_user) = state.data.get_user_permissions(&c.user_id) else {
                return false;
            };

            can_execute_bot_command(&c.permissions, granted_to_bot, &granted_to_user)
        }
    }
}

fn can_start_video_call(member_role: GroupRoleInternal, call_type: VideoCallType, chat: &GroupChatCore) -> bool {
    if !member_role.is_permitted(chat.permissions.start_video_call) {
        return false;
    }

    !chat.is_public.value || matches!(call_type, VideoCallType::Broadcast)
}
