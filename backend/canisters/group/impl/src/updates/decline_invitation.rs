use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::decline_invitation::{Response::*, *};
use ic_cdk_macros::update;

#[update]
#[trace]
fn decline_invitation(_args: Args) -> Response {
    run_regular_jobs();

    mutate_state(decline_invitation_impl)
}

fn decline_invitation_impl(state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = state.env.now();
    match state.data.chat.invited_users.remove(&caller, now) {
        Some(_) => Success,
        None => NotInvited,
    }
}
