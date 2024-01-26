use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use translations_canister::propose::{Response::*, *};

#[update]
#[trace]
fn propose(args: Args) -> Response {
    mutate_state(|state| propose_impl(args, state))
}

fn propose_impl(_args: Args, _state: &mut RuntimeState) -> Response {
    Success(0)
}
