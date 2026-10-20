use crate::guards::caller_is_escrow_canister;
use crate::updates::c2c_notify_p2p_swap_status_change::c2c_notify_p2p_swap_status_change_impl;
use crate::{execute_update_async, mutate_state};
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
async fn c2c_escrow(args: Args) -> Response {
    execute_update_async(|| c2c_escrow_impl(args)).await
}

// The events are checked together before any is applied, since applying one can await a lookup in
// the LocalUserIndex, during which a copy of this batch sent again must find them already seen
async fn c2c_escrow_impl(args: Args) -> Response {
    let events: Vec<_> = mutate_state(|state| {
        let caller = state.env.caller();
        args.events
            .into_iter()
            .filter(|event| {
                state
                    .data
                    .idempotency_checker
                    .check(caller, event.created_at, event.idempotency_id)
            })
            .map(|event| event.value)
            .collect()
    });

    for event in events {
        match event {
            EscrowEvent::SwapStatusChanged(change) => c2c_notify_p2p_swap_status_change_impl(change).await,
        }
    }
    SuccessOnly::Success
}
