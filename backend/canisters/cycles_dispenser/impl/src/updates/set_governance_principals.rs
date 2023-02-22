use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_tracing_macros::trace;
use cycles_dispenser_canister::set_governance_principals::{Response::*, *};
use ic_cdk_macros::update;

#[update(guard = "caller_is_governance_principal")]
#[trace]
fn set_governance_principals(args: Args) -> Response {
    mutate_state(|state| state.data.governance_principals = args.principals.into_iter().collect());
    Success
}
