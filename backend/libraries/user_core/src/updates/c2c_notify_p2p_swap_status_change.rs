use crate::User;
use chat_events::EventPusher;
use escrow_canister::{SwapStatus, SwapStatusChange};
use types::{Chat, ChatId, P2PSwapCancelled, P2PSwapExpired, P2PSwapLocation, P2PSwapStatus, TimestampMillis, UserId};
use user_canister::P2PSwapStatusChange;

// Applies the escrow canister's change to a swap's status to the user's copy of the message it was
// offered in, returning the chat and the change to send the other user. Only swaps in direct chats
// are the user's to record; the group or community records those in its chats.
pub fn c2c_notify_p2p_swap_status_change<P: EventPusher>(
    user: &mut User,
    my_user_id: UserId,
    args: SwapStatusChange,
    now: TimestampMillis,
    event_pusher: P,
) -> Option<(ChatId, P2PSwapStatusChange)> {
    let P2PSwapLocation::Message(m) = args.location else {
        return None;
    };
    let Chat::Direct(chat_id) = m.chat else {
        return None;
    };
    // The offerer's copy names the chat by the acceptor, and the acceptor's by the offerer
    let chat_id = if args.offered_by == my_user_id.as_principal() { chat_id } else { args.offered_by.into() };
    let chat = user.direct_chats.get_mut(&chat_id)?;

    let status = match args.status {
        SwapStatus::Expired(e) => {
            let content = chat.get_p2p_swap(m.thread_root_message_index, m.message_id)?;
            let token0_txn_out = e
                .refunds
                .into_iter()
                .find(|t| t.ledger == content.token0.ledger)
                .map(|t| t.block_index);
            let status = P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out });
            chat.set_p2p_swap_status(m.thread_root_message_index, m.message_id, status.clone(), now)
                .ok()?;
            status
        }
        SwapStatus::Cancelled(c) => {
            let content = chat.get_p2p_swap(m.thread_root_message_index, m.message_id)?;
            let token0_txn_out = c
                .refunds
                .into_iter()
                .find(|t| t.ledger == content.token0.ledger)
                .map(|t| t.block_index);
            let status = P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out });
            chat.set_p2p_swap_status(m.thread_root_message_index, m.message_id, status.clone(), now)
                .ok()?;
            status
        }
        SwapStatus::Completed(c) => {
            let result = chat
                .complete_p2p_swap(
                    c.accepted_by.into(),
                    m.thread_root_message_index,
                    m.message_id,
                    c.token0_transfer_out.block_index,
                    c.token1_transfer_out.block_index,
                    now,
                    event_pusher,
                )
                .ok()?;
            P2PSwapStatus::Completed(result.value)
        }
        _ => return None,
    };

    let thread_root_message_id = chat.thread_root_message_id(m.thread_root_message_index).ok()?;
    Some((
        chat_id,
        P2PSwapStatusChange {
            thread_root_message_id,
            message_id: m.message_id,
            status,
        },
    ))
}
