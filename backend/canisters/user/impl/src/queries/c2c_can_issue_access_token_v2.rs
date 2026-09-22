use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use serde::Deserialize;
use types::c2c_can_issue_access_token::AccessTypeArgs;
use user_canister::c2c_can_issue_access_token_v2::*;

// The local user index sends the previous shape (the bare `AccessTypeArgs`) until every User
// canister has been upgraded to accept the new one, since the previous wasm cannot read it
#[derive(Deserialize)]
#[serde(untagged)]
enum ArgsCompat {
    Current(Args),
    Legacy(AccessTypeArgs),
}

impl ArgsCompat {
    fn into_access_type_args(self) -> AccessTypeArgs {
        match self {
            ArgsCompat::Current(args) => args.args,
            ArgsCompat::Legacy(args) => args,
        }
    }
}

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token_v2(args: ArgsCompat) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args.into_access_type_args(), state))
}

fn c2c_can_issue_access_token_impl(args_outer: AccessTypeArgs, state: &RuntimeState) -> Response {
    if let AccessTypeArgs::BotActionByCommand(args) = &args_outer {
        // Get the permissions the user has granted to the bot
        let Some(granted) = state.data.user.bots.get(&args.bot_id).map(|b| &b.permissions) else {
            return Response::Failure;
        };

        return if args.requested_permissions.is_subset(granted) { Response::Success } else { Response::Failure };
    }

    let initiator = match &args_outer {
        AccessTypeArgs::StartVideoCall(args) => args.initiator,
        AccessTypeArgs::JoinVideoCall(args) => args.initiator,
        AccessTypeArgs::MarkVideoCallAsEnded(args) => args.initiator,
        _ => unreachable!(),
    };

    if state.data.user.blocked_users.contains(&initiator) {
        return Response::Failure;
    }

    if let AccessTypeArgs::BotActionByCommand(_) = &args_outer {
        return Response::Success;
    }

    Response::Success
}
