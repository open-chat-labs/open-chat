use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use identity_canister::c2c_sync_legacy_user_principals::{Response::*, *};

#[update(guard = "caller_is_user_index_canister")]
#[trace]
fn c2c_sync_legacy_user_principals(args: Args) -> Response {
    mutate_state(|state| c2c_sync_legacy_user_principals_impl(args, state))
}

fn c2c_sync_legacy_user_principals_impl(args: Args, state: &mut RuntimeState) -> Response {
    for principal in args.principals {
        state.data.legacy_principals.insert(principal);
    }
    Success
}
