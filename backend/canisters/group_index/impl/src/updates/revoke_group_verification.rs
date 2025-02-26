use crate::{guards::caller_is_governance_principal, mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::revoke_group_verification::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn revoke_group_verification(args: Args) -> Response {
    mutate_state(|state| revoke_group_verification_impl(args, state))
}

fn revoke_group_verification_impl(args: Args, state: &mut RuntimeState) -> Response {
    match state.set_verified_group(args.group_id, false) {
        true => Success,
        false => NotFound,
    }
}
