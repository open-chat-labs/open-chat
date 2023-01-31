use crate::guards::caller_is_controller;
use crate::mutate_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_index_canister::set_service_principals::{Response::*, *};

#[update(guard = "caller_is_controller")]
#[trace]
fn set_service_principals(args: Args) -> Response {
    mutate_state(|state| state.data.service_principals = args.principals.into_iter().collect());
    Success
}
