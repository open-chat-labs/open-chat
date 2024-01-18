use crate::guards::caller_is_escrow_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::{SwapStatus, SwapStatusChange as Args};
use types::{Chat, EventIndex, P2PSwapCancelled, P2PSwapExpired, P2PSwapLocation, P2PSwapStatus};

#[update_msgpack(guard = "caller_is_escrow_canister")]
#[trace]
fn c2c_notify_p2p_swap_status_change(args: Args) {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_p2p_swap_status_change_impl(args, state))
}

fn c2c_notify_p2p_swap_status_change_impl(args: Args, state: &mut RuntimeState) {
    let P2PSwapLocation::Message(m) = args.location;

    if let Chat::Channel(_, channel_id) = m.chat {
        if let Some(channel) = state.data.channels.get_mut(&channel_id) {
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

                        channel.chat.events.set_p2p_swap_status(
                            m.thread_root_message_index,
                            m.message_id,
                            P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out }),
                            state.env.now(),
                        );
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

                        channel.chat.events.set_p2p_swap_status(
                            m.thread_root_message_index,
                            m.message_id,
                            P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out }),
                            state.env.now(),
                        );
                    }
                }
                SwapStatus::Completed(c) => {
                    channel.chat.events.complete_p2p_swap(
                        c.accepted_by,
                        m.thread_root_message_index,
                        m.message_id,
                        c.token0_transfer_out.block_index,
                        c.token1_transfer_out.block_index,
                        state.env.now(),
                    );
                }
                _ => {}
            }
        }
    }
}
