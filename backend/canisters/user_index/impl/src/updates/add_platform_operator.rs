use crate::guards::caller_is_governance_principal;
use crate::mutate_state;
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use user_index_canister::add_platform_operator::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn add_platform_operator(args: Args) -> Response {
    mutate_state(|state| {
        state.data.platform_operators.insert(args.user_id);
    });

    Success
}
