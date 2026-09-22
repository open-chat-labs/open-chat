use crate::guards::caller_is_hosted_user;
use crate::mutate_state;
use crate::timer_job_types::CancelP2PSwapInEscrowCanisterJob;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::UserId;
use user_canister::cancel_p2p_swap::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn cancel_p2p_swap(args: Args) -> Response {
    let cancelled = mutate_state(|state| {
        let canister_id = state.env.canister_id();
        let now = state.env.now();
        state.with_caller_user_mut(|my_index, user| {
            let my_user_id = UserId::new_indexed(canister_id, my_index);
            user_core::updates::cancel_p2p_swap(user, my_user_id, args, now).map(|swap_id| (my_index, swap_id))
        })
    });
    match cancelled {
        Ok((my_index, swap_id)) => {
            CancelP2PSwapInEscrowCanisterJob::run(my_index, swap_id);
            Response::Success
        }
        Err(error) => Response::Error(error),
    }
}
