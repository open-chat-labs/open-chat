use std::collections::HashSet;

use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::c2c_can_issue_access_token::*;
use group_chat_core::{GroupChatCore, GroupRoleInternal};
use types::c2c_can_issue_access_token::AccessTypeArgs;
use types::BotPermissions;
use types::MessagePermission;
use types::VideoCallType;
use utils::bots::can_bot_execute_action;
use utils::bots::intersect_permissions;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args_outer: Args, state: &RuntimeState) -> Response {
    if let AccessTypeArgs::BotActionByApiKey(args) = &args_outer.access_type {
        let api_key_option = if let Some(channel_id) = args_outer.channel_id {
            if let Some(channel) = state.data.channels.get(&channel_id) {
                channel.bot_api_keys.get(&args.bot_id)
            } else {
                return Response::Failure;
            }
        } else {
            state.data.bot_api_keys.get(&args.bot_id)
        };

        let Some(api_key) = api_key_option else {
            return Response::Failure;
        };

        if api_key.secret != args.secret {
            return Response::Failure;
        }

        let granted = intersect_permissions(&api_key.permissions, &args.requested_permissions);

        if can_bot_execute_action(&get_text_message_permission(), &granted) {
            return Response::SuccessBot(granted);
        } else {
            return Response::Failure;
        }
    }

    if let AccessTypeArgs::BotActionByCommand(args) = &args_outer.access_type {
        // Get the permissions granted to the bot in this community
        let Some(granted_to_bot) = state.data.get_bot_permissions(&args.bot_id) else {
            return Response::Failure;
        };

        // Get the permissions granted to the user in this group
        let Some(granted_to_user) = state
            .data
            .get_user_permissions_for_bot_commands(&args.initiator, args_outer.channel_id)
        else {
            return Response::Failure;
        };

        let granted = intersect_permissions(granted_to_bot, &granted_to_user);
        let granted = intersect_permissions(&granted, &args.requested_permissions);

        if can_bot_execute_action(&get_text_message_permission(), &granted) {
            return Response::SuccessBot(granted);
        } else {
            return Response::Failure;
        }
    }

    let Some(channel) = args_outer
        .channel_id
        .and_then(|channel_id| state.data.channels.get(&channel_id))
    else {
        return Response::Failure;
    };

    let initiator = match &args_outer.access_type {
        AccessTypeArgs::StartVideoCall(args) => args.initiator,
        AccessTypeArgs::JoinVideoCall(args) => args.initiator,
        AccessTypeArgs::MarkVideoCallAsEnded(args) => args.initiator,
        _ => unreachable!(),
    };

    let Ok(member) = channel.chat.members.get_verified_member(initiator) else {
        return Response::Failure;
    };

    match &args_outer.access_type {
        AccessTypeArgs::JoinVideoCall(_) | AccessTypeArgs::MarkVideoCallAsEnded(_) => Response::Success,
        AccessTypeArgs::StartVideoCall(args) => {
            if can_start_video_call(member.role(), args.call_type, &channel.chat) {
                Response::Success
            } else {
                Response::Failure
            }
        }
        _ => unreachable!(),
    }
}

fn can_start_video_call(member_role: GroupRoleInternal, call_type: VideoCallType, chat: &GroupChatCore) -> bool {
    if !member_role.is_permitted(chat.permissions.start_video_call) {
        return false;
    }

    !chat.is_public.value || matches!(call_type, VideoCallType::Broadcast)
}

fn get_text_message_permission() -> BotPermissions {
    BotPermissions {
        community: HashSet::new(),
        chat: HashSet::new(),
        message: HashSet::from_iter(vec![MessagePermission::Text]),
    }
}
