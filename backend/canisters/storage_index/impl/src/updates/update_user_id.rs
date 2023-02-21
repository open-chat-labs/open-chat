use crate::guards::caller_is_user_controller;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_index_canister::update_user_id::*;

#[update(guard = "caller_is_user_controller")]
#[trace]
fn update_user_id(_args: Args) -> Response {
    // TODO
    panic!();
}
