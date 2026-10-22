use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use user_index_canister::start_bridged_user_link::*;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
fn start_bridged_user_link(args: Args) -> Response {
    mutate_state(|state| start_bridged_user_link_impl(args, state))
}

fn start_bridged_user_link_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let Some(user) = state.data.users.get_by_principal(&caller) else {
        return Response::Error(OCErrorCode::InitiatorNotFound.into());
    };
    if user.user_type.is_bot() {
        return Response::Error(OCErrorCode::InitiatorNotAuthorized.into());
    }
    if !state.data.bridge_bots.contains_key(&args.platform) {
        return Response::Error(OCErrorCode::InvalidRequest.with_message(format!("No bot bridges {} yet", args.platform)));
    }
    // One account per platform, so a user unlinks theirs before linking another
    if state
        .data
        .bridged_users
        .linked_to(user.user_id)
        .iter()
        .any(|account| account.user.platform() == args.platform)
    {
        return Response::Error(
            OCErrorCode::AlreadyAdded.with_message(format!("A {} account is already linked, unlink it first", args.platform)),
        );
    }

    let user_id = user.user_id;
    let code = format!("{:032x}", state.env.rng().random::<u128>());
    let now = state.env.now();
    let expires = state.data.bridged_users.start_link(user_id, args.platform, code.clone(), now);

    Response::Success(SuccessResult { code, expires })
}
