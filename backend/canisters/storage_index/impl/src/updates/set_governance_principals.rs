use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use storage_index_canister::set_governance_principals::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn set_governance_principals(args: Args) -> Response {
    mutate_state(|state| state.data.governance_principals = args.principals.into_iter().collect());
    Success
}
