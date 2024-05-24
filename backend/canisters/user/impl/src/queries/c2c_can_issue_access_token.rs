use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query_msgpack;
use types::AccessTokenType;
use user_canister::c2c_can_issue_access_token::*;

#[query_msgpack(guard = "caller_is_local_user_index")]
fn c2c_can_issue_access_token(args: Args) -> Response {
    read_state(|state| c2c_can_issue_access_token_impl(args, state))
}

fn c2c_can_issue_access_token_impl(args: Args, state: &RuntimeState) -> bool {
    if state.data.blocked_users.contains(&args.user_id) {
        return false;
    }

    match args.access_type {
        AccessTokenType::StartVideoCall
        | AccessTokenType::StartVideoCallV2(_)
        | AccessTokenType::JoinVideoCall
        | AccessTokenType::MarkVideoCallAsEnded => true,
    }
}
