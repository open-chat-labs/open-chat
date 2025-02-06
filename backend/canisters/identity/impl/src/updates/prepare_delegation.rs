use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use identity_canister::prepare_delegation::{Response::*, *};

#[update]
#[trace]
fn prepare_delegation(args: Args) -> Response {
    mutate_state(|state| prepare_delegation_impl(args, state))
}

fn prepare_delegation_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();

    let Some(user) = state.data.user_principals.get_by_auth_principal(&caller) else {
        return NotFound;
    };

    if args.is_ii_principal.unwrap_or_default() {
        state.data.user_principals.set_ii_principal(&caller);
    }

    let seed = state.data.calculate_seed(user.index);

    Success(state.prepare_delegation(seed, args.session_key, args.max_time_to_live))
}
