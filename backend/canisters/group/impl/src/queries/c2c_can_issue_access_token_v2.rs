use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::c2c_can_issue_access_token_v2::*;
use group_chat_core::{GroupChatCore, GroupRoleInternal};
use types::c2c_can_issue_access_token::AccessTypeArgs;
use types::VideoCallType;
use utils::bots::can_bot_execute_action;
use utils::bots::intersect_permissions;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token_v2(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args_outer: Args, state: &RuntimeState) -> Response {
    if let AccessTypeArgs::BotActionByApiKey(args) = &args_outer {
        if let Some(granted_permissions) = state
            .data
            .bot_api_keys
            .permissions_if_secret_matches(&args.bot_id, &args.secret)
        {
            return Response::SuccessBot(granted_permissions.clone());
        } else {
            return Response::Failure;
        }
    }

    if let AccessTypeArgs::BotActionByCommand(args) = &args_outer {
        // Get the permissions granted to the bot in this group
        let Some(granted_to_bot) = state.data.get_bot_permissions(&args.bot_id) else {
            return Response::Failure;
        };

        // Get the permissions granted to the user in this group
        let Some(granted_to_user) = state.data.get_user_permissions_for_bot_commands(&args.initiator) else {
            return Response::Failure;
        };

        let available = intersect_permissions(granted_to_bot, &granted_to_user);

        if can_bot_execute_action(&args.requested_permissions, &available) {
            return Response::SuccessBot(available);
        } else {
            return Response::Failure;
        }
    }

    let initiator = match &args_outer {
        AccessTypeArgs::StartVideoCall(args) => args.initiator,
        AccessTypeArgs::JoinVideoCall(args) => args.initiator,
        AccessTypeArgs::MarkVideoCallAsEnded(args) => args.initiator,
        _ => unreachable!(),
    };

    let Ok(member) = state.data.chat.members.get_verified_member(initiator) else {
        return Response::Failure;
    };

    match args_outer {
        AccessTypeArgs::JoinVideoCall(_) | AccessTypeArgs::MarkVideoCallAsEnded(_) => Response::Success,
        AccessTypeArgs::StartVideoCall(args) => {
            if can_start_video_call(member.role(), args.call_type, &state.data.chat) {
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
