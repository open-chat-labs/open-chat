use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use std::collections::HashSet;
use types::c2c_can_issue_access_token::AccessTypeArgs;
use types::BotPermissions;
use types::MessagePermission;
use user_canister::c2c_can_issue_access_token_v2::*;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token_v2(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args_outer: Args, state: &RuntimeState) -> Response {
    if let AccessTypeArgs::BotActionByApiKey(_) = &args_outer {
        return Response::SuccessBot(all_direct_chat_permissions());
    }

    let initiator = match &args_outer {
        AccessTypeArgs::StartVideoCall(args) => args.initiator,
        AccessTypeArgs::JoinVideoCall(args) => args.initiator,
        AccessTypeArgs::MarkVideoCallAsEnded(args) => args.initiator,
        AccessTypeArgs::BotActionByCommand(args) => args.initiator,
        _ => unreachable!(),
    };

    if state.data.blocked_users.contains(&initiator) {
        return Response::Failure;
    }

    if let AccessTypeArgs::BotActionByCommand(_) = &args_outer {
        return Response::SuccessBot(all_direct_chat_permissions());
    }

    Response::Success
}

fn all_direct_chat_permissions() -> BotPermissions {
    use MessagePermission::*;

    BotPermissions {
        community: HashSet::new(),
        chat: HashSet::new(),
        message: HashSet::from_iter(vec![Text, Image, Video, Audio, File, Crypto, Giphy, P2pSwap]),
    }
}
