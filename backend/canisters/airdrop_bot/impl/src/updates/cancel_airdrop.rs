use crate::guards::caller_is_admin;
use crate::jobs::execute_airdrop::clear_airdrop_timer;
use crate::{RuntimeState, mutate_state};
use airdrop_bot_canister::cancel_airdrop::*;
use canister_tracing_macros::trace;
use ic_cdk::update;

#[update(guard = "caller_is_admin")]
#[trace]
fn cancel_airdrop(_args: Args) -> Response {
    mutate_state(cancel_airdrop_impl)
}

fn cancel_airdrop_impl(state: &mut RuntimeState) -> Response {
    if state.data.airdrops.cancel().is_some() {
        clear_airdrop_timer();
    }

    Response::Success
}
