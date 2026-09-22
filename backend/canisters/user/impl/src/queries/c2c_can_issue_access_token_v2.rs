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
    let can_issue =
        read_state(|state| user_core::queries::c2c_can_issue_access_token(&state.data.user, args.into_access_type_args()));
    if can_issue { Response::Success } else { Response::Failure }
}
