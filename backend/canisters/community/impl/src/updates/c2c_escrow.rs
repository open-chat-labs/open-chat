use crate::guards::caller_is_escrow_canister;
use crate::updates::c2c_notify_p2p_swap_status_change::c2c_notify_p2p_swap_status_change_impl;
use crate::{RuntimeState, execute_update_even_if_frozen};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::EscrowEvent;
use escrow_canister::c2c_escrow::*;
use types::SuccessOnly;

// Must be fed by a single queue on the Escrow canister: the idempotency check keeps one high-water
// mark per sender, so a batch retried from a second queue after a later batch from the first had
// landed would be dropped as already seen
#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
fn c2c_escrow(args: Args) -> Response {
    execute_update_even_if_frozen(|state| c2c_escrow_impl(args, state))
}

fn c2c_escrow_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            match event.value {
                EscrowEvent::SwapStatusChanged(change) => c2c_notify_p2p_swap_status_change_impl(change, state),
            }
        }
    }
    SuccessOnly::Success
}
