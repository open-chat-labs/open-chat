use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use user_canister::c2c_can_issue_access_token_v2::*;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_can_issue_access_token_v2(args: Args) -> Response {
    // A user this canister doesn't hold can't have granted anything
    let can_issue = read_state(|state| {
        state
            .with_user(args.user_id, |user| {
                user_core::queries::c2c_can_issue_access_token(user, &args.args)
            })
            .unwrap_or(false)
    });
    if can_issue { Response::Success } else { Response::Failure }
}
