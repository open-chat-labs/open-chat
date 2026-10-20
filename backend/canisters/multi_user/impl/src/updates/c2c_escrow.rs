use crate::guards::caller_is_escrow_canister;
use crate::updates::c2c_notify_p2p_swap_status_change::{apply, resolve};
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

// Each event is resolved first, which can await a lookup in the LocalUserIndex, and only then checked
// and applied, together in one synchronous step. The lookup traps on a failure worth retrying, so
// that the escrow canister sends the batch again: had the event been checked first, it would be left
// marked as seen but never applied. A copy of the batch sent meanwhile can't apply anything twice, as
// each event is checked and applied together.
async fn c2c_escrow_impl(args: Args) -> Response {
    for event in args.events {
        let (created_at, idempotency_id) = (event.created_at, event.idempotency_id);
        match event.value {
            EscrowEvent::SwapStatusChanged(change) => {
                let resolved = resolve(&change).await;
                mutate_state(|state| {
                    let caller = state.env.caller();
                    if state.data.idempotency_checker.check(caller, created_at, idempotency_id)
                        && let Some((recipient_index, other)) = resolved
                    {
                        apply(change, recipient_index, other, state);
                    }
                });
            }
        }
    }
    SuccessOnly::Success
}
