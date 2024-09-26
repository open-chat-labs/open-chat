use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::decline_invitation::{Response::*, *};

#[update(candid = true, msgpack = true)]
#[trace]
fn decline_invitation(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(decline_invitation_impl)
}

fn decline_invitation_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    match state.data.remove_invitation(caller, now) {
        Some(_) => Success,
        None => NotInvited,
    }
}
