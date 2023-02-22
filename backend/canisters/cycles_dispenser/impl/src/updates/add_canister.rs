use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, State};
use canister_tracing_macros::trace;
use cycles_dispenser_canister::add_canister::{Response::*, *};
use ic_cdk_macros::update;

#[update(guard = "caller_is_governance_principal")]
#[trace]
fn add_canister(args: Args) -> Response {
    mutate_state(|state| add_canister_impl(args, state))
}

fn add_canister_impl(args: Args, state: &mut State) -> Response {
    let now = state.env.now();
    if state.data.canisters.add(args.canister_id, now) {
        Success
    } else {
        AlreadyAdded
    }
}
