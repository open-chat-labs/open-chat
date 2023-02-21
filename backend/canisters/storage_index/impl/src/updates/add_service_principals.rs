use crate::guards::caller_is_service_principal;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_index_canister::add_service_principals::{Response::*, *};

#[update(guard = "caller_is_service_principal")]
#[trace]
fn add_service_principals(args: Args) -> Response {
    mutate_state(|state| add_service_principals_impl(args, state))
}

fn add_service_principals_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.data.service_principals.extend(args.principals);
    Success
}
