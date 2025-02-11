use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use types::c2c_can_issue_access_token::AccessTypeArgs;
use user_canister::c2c_can_issue_access_token_v2::*;

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

        if granted_opt.is_some_and(|granted| args.requested_permissions.is_subset(granted)) {
            return Response::Success;
        } else {
            return Response::Failure;
        }
    }

    if let AccessTypeArgs::BotActionByCommand(args) = &args_outer {
        // Get the permissions the user has granted to the bot
        let Some(granted) = state.data.bots.get(&args.bot_id).map(|b| &b.permissions) else {
            return Response::Failure;
        };

        if args.requested_permissions.is_subset(granted) {
            return Response::Success;
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

    if state.data.blocked_users.contains(&initiator) {
        return Response::Failure;
    }

    if let AccessTypeArgs::BotActionByCommand(_) = &args_outer {
        return Response::Success;
    }

    Response::Success
}
