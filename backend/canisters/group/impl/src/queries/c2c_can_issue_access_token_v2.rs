use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use group_canister::c2c_can_issue_access_token_v2::*;
use group_chat_core::{GroupChatCore, GroupRoleInternal};
use types::c2c_can_issue_access_token::AccessTypeArgs;
use types::BotPermissions;
use types::VideoCallType;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token_v2(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args_outer: Args, state: &RuntimeState) -> Response {
    if let AccessTypeArgs::BotActionByApiKey(args) = &args_outer {
        let granted_opt = state
            .data
            .bot_api_keys
            .permissions_if_secret_matches(&args.bot_id, &args.secret);

        return if granted_opt.is_some_and(|granted| args.requested_permissions.is_subset(granted)) {
            Response::Success
        } else {
            Response::Failure
        };
    } else if let AccessTypeArgs::BotActionByCommand(args) = &args_outer {
        // If this is an "owner only" command ensure the initiator is an owner of the given scope
        if args.owner_only
            && !state
                .data
                .get_member(args.initiator.into())
                .is_some_and(|member| member.role().is_owner())
        {
            return Response::Failure;
        }

        // Get the permissions granted to the bot in this group
        let Some(granted_to_bot) = state.data.get_bot_permissions(&args.bot_id) else {
            return Response::Failure;
        };

        // Get the permissions granted to the user in this group
        let Some(granted_to_user) = state.data.get_user_permissions(&args.initiator) else {
            return Response::Failure;
        };

        let granted = BotPermissions::intersect(granted_to_bot, &granted_to_user);

        return if args.requested_permissions.is_subset(&granted) { Response::Success } else { Response::Failure };
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
