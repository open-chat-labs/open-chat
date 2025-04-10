use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_escrow_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::{SwapStatus, SwapStatusChange as Args};
use types::{EventIndex, P2PSwapCancelled, P2PSwapExpired, P2PSwapLocation, P2PSwapStatus};

#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
fn c2c_notify_p2p_swap_status_change(args: Args) {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_p2p_swap_status_change_impl(args, state))
}

fn c2c_notify_p2p_swap_status_change_impl(args: Args, state: &mut RuntimeState) {
    let P2PSwapLocation::Message(m) = args.location;
    let mut updated = false;

    match args.status {
        SwapStatus::Expired(e) => {
            if let Some(content) =
                state
                    .data
                    .chat
                    .events
                    .get_p2p_swap(m.thread_root_message_index, m.message_id, EventIndex::default())
            {
                let token0_txn_out = e
                    .refunds
                    .into_iter()
                    .find(|t| t.ledger == content.token0.ledger)
                    .map(|t| t.block_index);

                updated = state.data.chat.events.set_p2p_swap_status(
                    m.thread_root_message_index,
                    m.message_id,
                    P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out }),
                    state.env.now(),
                );
            }
        }
        SwapStatus::Cancelled(c) => {
            if let Some(content) =
                state
                    .data
                    .chat
                    .events
                    .get_p2p_swap(m.thread_root_message_index, m.message_id, EventIndex::default())
            {
                let token0_txn_out = c
                    .refunds
                    .into_iter()
                    .find(|t| t.ledger == content.token0.ledger)
                    .map(|t| t.block_index);

                updated = state.data.chat.events.set_p2p_swap_status(
                    m.thread_root_message_index,
                    m.message_id,
                    P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out }),
                    state.env.now(),
                );
            }
        }
        SwapStatus::Completed(c) => {
            updated = state
                .data
                .chat
                .events
                .complete_p2p_swap(
                    c.accepted_by,
                    m.thread_root_message_index,
                    m.message_id,
                    c.token0_transfer_out.block_index,
                    c.token1_transfer_out.block_index,
                    state.env.now(),
                    &mut state.data.event_store_client,
                )
                .is_ok();
        }
        _ => {}
    }

    if updated {
        handle_activity_notification(state);
    }
}
