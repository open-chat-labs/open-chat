use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_escrow_canister;
use crate::{CommunityEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::{SwapStatus, SwapStatusChange as Args};
use types::{Chat, EventIndex, P2PSwapCancelled, P2PSwapExpired, P2PSwapLocation, P2PSwapStatus};

#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
fn c2c_notify_p2p_swap_status_change(args: Args) {
    execute_update(|state| c2c_notify_p2p_swap_status_change_impl(args, state))
}

fn c2c_notify_p2p_swap_status_change_impl(args: Args, state: &mut RuntimeState) {
    let P2PSwapLocation::Message(message) = args.location else {
        return;
    };

    let Chat::Channel(_, channel_id) = message.chat else {
        return;
    };

    let Some(channel) = state.data.channels.get_mut(&channel_id) else {
        return;
    };

    let mut result = None;

    match args.status {
        SwapStatus::Expired(e) => {
            if let Some(content) =
                channel
                    .chat
                    .events
                    .get_p2p_swap(message.thread_root_message_index, message.message_id, EventIndex::default())
            {
                let token0_txn_out = e
                    .refunds
                    .into_iter()
                    .find(|t| t.ledger == content.token0.ledger)
                    .map(|t| t.block_index);

                result = channel
                    .chat
                    .events
                    .set_p2p_swap_status(
                        message.thread_root_message_index,
                        message.message_id,
                        P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out }),
                        state.env.now(),
                    )
                    .ok();
            }
        }
        SwapStatus::Cancelled(c) => {
            if let Some(content) =
                channel
                    .chat
                    .events
                    .get_p2p_swap(message.thread_root_message_index, message.message_id, EventIndex::default())
            {
                let token0_txn_out = c
                    .refunds
                    .into_iter()
                    .find(|t| t.ledger == content.token0.ledger)
                    .map(|t| t.block_index);

                result = channel
                    .chat
                    .events
                    .set_p2p_swap_status(
                        message.thread_root_message_index,
                        message.message_id,
                        P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out }),
                        state.env.now(),
                    )
                    .ok();
            }
        }
        SwapStatus::Completed(c) => {
            let now = state.env.now();
            result = channel
                .chat
                .events
                .complete_p2p_swap(
                    c.accepted_by.into(),
                    message.thread_root_message_index,
                    message.message_id,
                    c.token0_transfer_out.block_index,
                    c.token1_transfer_out.block_index,
                    now,
                    CommunityEventPusher {
                        now,
                        rng: state.env.rng(),
                        queue: &mut state.data.local_user_index_event_sync_queue,
                    },
                )
                .map(|result| result.drop_value())
                .ok();
        }
        _ => {}
    }

    if let Some(success) = result {
        state.push_bot_notification(success.bot_notification);
        handle_activity_notification(state);
    }
}
