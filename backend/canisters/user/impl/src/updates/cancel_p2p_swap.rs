use crate::guards::caller_is_owner;
use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{OCResult, UserId};
use user_canister::cancel_p2p_swap::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn cancel_p2p_swap(args: Args) -> Response {
    match execute_update(|state| cancel_p2p_swap_impl(args, state)) {
        Ok(swap_id) => {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
            Response::Success
        }
        Err(error) => Response::Error(error),
    }
}

fn cancel_p2p_swap_impl(args: Args, state: &mut RuntimeState) -> OCResult<u32> {
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    user_core::updates::cancel_p2p_swap(&mut state.data.user, my_user_id, args, now)
}
