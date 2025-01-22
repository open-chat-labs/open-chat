use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::cancel_swap::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn cancel_swap(args: Args) -> Response {
    mutate_state(|state| cancel_swap_impl(args, state))
}

fn cancel_swap_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(swap) = state.data.swaps.get_mut(args.swap_id) {
        let caller = state.env.caller();
        let now = state.env.now();

        if !swap.is_admin(caller) {
            NotAuthorized
        } else if swap.accepted_by.is_some() {
            SwapAlreadyAccepted
        } else if swap.expires_at < now {
            SwapExpired
        } else {
            if swap.cancelled_at.is_none() {
                swap.cancelled_at = Some(now);
                state.data.pending_payments_queue.push_refunds(swap, now);
                crate::jobs::make_pending_payments::start_job_if_required(state);
            }
            Success
        }
    } else {
        SwapNotFound
    }
}
