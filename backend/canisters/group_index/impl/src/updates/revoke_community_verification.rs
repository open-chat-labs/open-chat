use crate::{guards::caller_is_governance_principal, mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use group_index_canister::revoke_community_verification::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn revoke_community_verification(args: Args) -> Response {
    mutate_state(|state| revoke_community_verification_impl(args, state))
}

fn revoke_community_verification_impl(args: Args, state: &mut RuntimeState) -> Response {
    match state.set_verified_community(args.community_id, false) {
        true => Success,
        false => NotFound,
    }
}
