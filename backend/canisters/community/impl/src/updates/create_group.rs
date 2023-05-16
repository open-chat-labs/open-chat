use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::create_group::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn create_group(args: Args) -> Response {
    mutate_state(|state| create_group_impl(args, state))
}

fn create_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    unimplemented!()
}
