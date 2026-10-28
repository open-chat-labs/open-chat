use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use community_canister::c2c_can_issue_access_token::*;
use types::BotPermissions;
use types::c2c_can_issue_access_token::AccessTypeArgs;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args_outer: Args, state: &RuntimeState) -> Response {
    if let AccessTypeArgs::BotActionByCommand(args) = &args_outer.access_type {
        // Ensure the initiator has the necessary seniority according to required role
        if !state
            .data
            .is_same_or_senior(args.initiator.as_principal(), args_outer.channel_id, args.initiator_role)
        {
            return Response::Failure;
        }

        // Get the permissions granted to the bot in this community
        let Some(granted_to_bot) = state.data.bots.get(&args.bot_id).map(|b| &b.permissions) else {
            return Response::Failure;
        };

        // Get the permissions granted to the user in this community
        let Some(granted_to_user) = state.data.get_user_permissions(&args.initiator, args_outer.channel_id) else {
            return Response::Failure;
        };

        let granted = BotPermissions::intersect(granted_to_bot, &granted_to_user);

        return if args.requested_permissions.is_subset(&granted) { Response::Success } else { Response::Failure };
    }

    let Some(channel) = args_outer
        .channel_id
        .and_then(|channel_id| state.data.channels.get(&channel_id))
    else {
        return Response::Failure;
    };

    // The MiniApp service's chat token: a member of the channel, and of the community, whose membership
    // hasn't lapsed and who isn't suspended, who may join its games, or, as anyone can see a public
    // channel in a public community, someone who may watch them
    if let AccessTypeArgs::MiniAppChat(args) = &args_outer.access_type {
        let can = if args.member {
            state.data.members.get_verified_member(args.initiator.as_principal()).is_ok()
                && channel.chat.members.get_verified_member(args.initiator).is_ok()
        } else {
            state.data.is_public.value && channel.chat.is_public.value && !state.data.members.is_blocked(&args.initiator)
        };
        return if can { Response::Success } else { Response::Failure };
    }

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
        AccessTypeArgs::StartVideoCall(_) => {
            if member.role().is_permitted(channel.chat.permissions.start_video_call) {
                Response::Success
            } else {
                Response::Failure
            }
        }
        _ => unreachable!(),
    }
}
