use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::c2c_can_issue_access_token_for_channel::*;
use group_chat_core::{GroupChatCore, GroupRoleInternal};
use types::{CheckAccessTokenType, VideoCallType};
use utils::bots::can_bot_execute_action;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token_for_channel(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_for_channel_impl(args, state))
}

fn c2c_can_issue_access_token_for_channel_impl(args: Args, state: &RuntimeState) -> bool {
    let Some(channel) = state.data.channels.get(&args.channel_id) else {
        return false;
    };

    let Ok(member) = channel.chat.members.get_verified_member(args.user_id) else {
        return false;
    };

    match args.access_type {
        CheckAccessTokenType::StartVideoCallV2(vc) => {
            can_start_video_call(member.role(), state.data.is_public.value, vc.call_type, &channel.chat)
        }
        CheckAccessTokenType::JoinVideoCall | CheckAccessTokenType::MarkVideoCallAsEnded => true,
        CheckAccessTokenType::BotCommand(c) => {
            // Get the permissions granted to the bot in this community
            let Some(granted_to_bot) = state.data.get_bot_permissions(&c.bot) else {
                return false;
            };

            // Get the permissions granted to the user in this community/channel
            let Some(granted_to_user) = state.data.get_user_permissions_for_bot_commands(&c.user_id, &args.channel_id) else {
                return false;
            };

            can_bot_execute_action(&c.permissions, granted_to_bot, &granted_to_user)
        }
    }
}

fn can_start_video_call(
    member_role: GroupRoleInternal,
    is_public_community: bool,
    call_type: VideoCallType,
    chat: &GroupChatCore,
) -> bool {
    if !member_role.is_permitted(chat.permissions.start_video_call) {
        return false;
    }

    !is_public_community || !chat.is_public.value || matches!(call_type, VideoCallType::Broadcast)
}
