use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::c2c_can_issue_access_token::*;
use group_chat_core::{GroupChatCore, GroupRoleInternal};
use types::c2c_can_issue_access_token::AccessTypeArgs;
use types::BotPermissions;
use types::VideoCallType;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args_outer: Args, state: &RuntimeState) -> Response {
    if let AccessTypeArgs::BotActionByApiKey(args) = &args_outer.access_type {
        let granted_permissions_opt = if let Some(channel_id) = args_outer.channel_id {
            if let Some(channel) = state.data.channels.get(&channel_id) {
                channel.bot_api_keys.permissions_if_secret_matches(&args.bot_id, &args.secret)
            } else {
                return Response::Failure;
            }
        } else {
            state
                .data
                .bot_api_keys
                .permissions_if_secret_matches(&args.bot_id, &args.secret)
        };

        let Some(granted_permissions) = granted_permissions_opt else {
            return Response::Failure;
        };

        let available = BotPermissions::intersect(granted_permissions, &args.requested_permissions);

        if BotPermissions::text_only().is_subset(&available) {
            return Response::SuccessBot(available);
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

        let granted = BotPermissions::intersect(granted_to_bot, &granted_to_user);
        let available = BotPermissions::intersect(&granted, &args.requested_permissions);

        if BotPermissions::text_only().is_subset(&available) {
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
