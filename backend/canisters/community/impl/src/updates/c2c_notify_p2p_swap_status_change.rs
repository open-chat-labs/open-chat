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
    let P2PSwapLocation::Message(m) = args.location else {
        return;
    };

    let mut result = None;

    if let Chat::Channel(_, channel_id) = m.chat
        && let Some(channel) = state.data.channels.get_mut(&channel_id)
    {
        match args.status {
            SwapStatus::Expired(e) => {
                if let Some(content) =
                    channel
                        .chat
                        .events
                        .get_p2p_swap(m.thread_root_message_index, m.message_id, EventIndex::default())
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
                            m.thread_root_message_index,
                            m.message_id,
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
                        .get_p2p_swap(m.thread_root_message_index, m.message_id, EventIndex::default())
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
                            m.thread_root_message_index,
                            m.message_id,
                            P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out }),
                            state.env.now(),
                        )
                        .ok();
                }
            }
            SwapStatus::Completed(c) => {
                let now = state.env.now();
                // Escrow identifies the acceptor by the owner of their wallet, which the swap
                // recorded when they reserved it. For a swap reserved before that was recorded,
                // whose acceptor was alone in their canister, the owner is their user id.
                let accepted_by = channel
                    .chat
                    .events
                    .p2p_swap_reserved_by(m.thread_root_message_index, m.message_id, c.accepted_by)
                    .or_else(|| state.data.members.lookup_user_id(c.accepted_by))
                    .unwrap_or(c.accepted_by.into());
                result = channel
                    .chat
                    .events
                    .complete_p2p_swap(
                        accepted_by,
                        m.thread_root_message_index,
                        m.message_id,
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
    }

    if let Some(success) = result {
        state.push_bot_notification(success.bot_notification);
        handle_activity_notification(state);
    }
}
