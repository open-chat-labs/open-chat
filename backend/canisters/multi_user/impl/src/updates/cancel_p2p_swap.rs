use crate::guards::caller_is_hosted_user;
use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{OCResult, UserId};
use user_canister::cancel_p2p_swap::*;

// The User canister's `cancel_p2p_swap`. This canister created the swap in the escrow canister for
// the user, so may cancel it there, which refunds their deposit to their wallet.
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn cancel_p2p_swap(args: Args) -> Response {
    match mutate_state(|state| cancel_p2p_swap_impl(args, state)) {
        Ok(swap_id) => {
            CancelP2PSwapInEscrowCanisterJob::run(swap_id);
            Response::Success
        }
        Err(error) => Response::Error(error),
    }
}

fn cancel_p2p_swap_impl(args: Args, state: &mut RuntimeState) -> OCResult<u32> {
    let this_canister_id = state.env.canister_id();
    let now = state.env.now();
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = UserId::new_indexed(this_canister_id, my_index);
    state
        .data
        .users
        .with_user_mut(my_index, |user| {
            user_core::updates::cancel_p2p_swap(user, my_user_id, args, now, &state.data.migrated_user_ids)
        })
        .expect("User not found")
}
