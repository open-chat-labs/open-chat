use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::cancel_swap::{Response::*, *};

#[update_candid_and_msgpack]
#[trace]
fn cancel_swap(args: Args) -> Response {
    mutate_state(|state| cancel_swap_impl(args, state))
}

fn cancel_swap_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Some(swap) = state.data.swaps.get_mut(args.swap_id) {
        let user_id = state.env.caller().into();
        let now = state.env.now();
        if swap.created_by != user_id {
            NotAuthorized
        } else if swap.accepted_by.is_some() {
            SwapAlreadyAccepted
        } else if swap.expires_at < now {
            SwapExpired
        } else {
            if swap.cancelled_at.is_none() {
                swap.cancelled_at = Some(now);
                if swap.token0_received {
                    state.data.pending_payments_queue.push(PendingPayment {
                        user_id: swap.created_by,
                        timestamp: now,
                        token_info: swap.token0.clone(),
                        amount: swap.amount0,
                        swap_id: swap.id,
                        reason: PendingPaymentReason::Refund,
                    });
                }
                if swap.token1_received {
                    if let Some((accepted_by, _)) = swap.accepted_by {
                        state.data.pending_payments_queue.push(PendingPayment {
                            user_id: accepted_by,
                            timestamp: now,
                            token_info: swap.token1.clone(),
                            amount: swap.amount1,
                            swap_id: swap.id,
                            reason: PendingPaymentReason::Refund,
                        });
                    }
                }
                crate::jobs::make_pending_payments::start_job_if_required(state);
            }
            Success
        }
    } else {
        SwapNotFound
    }
}
