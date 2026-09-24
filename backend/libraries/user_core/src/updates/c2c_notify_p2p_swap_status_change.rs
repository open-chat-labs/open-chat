use crate::User;
use candid::Principal;
use chat_events::EventPusher;
use escrow_canister::{SwapStatus, SwapStatusChange};
use tracing::error;
use types::{
    CanisterId, P2PSwapCancelled, P2PSwapExpired, P2PSwapLocation, P2PSwapStatus, TimestampMillis, UserId, UserIdAndPrincipal,
};
use user_canister::P2PSwapStatusChange;
use utils::canister::delay_if_should_retry_failed_c2c_call;

// The user escrow names by `principal` as the offerer of a swap, the principal being the owner of
// their wallet: their user id if they are alone in their canister, otherwise their principal, which
// the LocalUserIndex resolves to their user id. None if there is no such user.
pub async fn offerer_user_id(principal: Principal, local_user_index_canister_id: CanisterId) -> Option<UserId> {
    if UserId::from(principal).is_canister() {
        return Some(principal.into());
    }
    let args = local_user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: principal,
    };
    match local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &args).await {
        // The LocalUserIndex also finds a user alone in their canister by the principal they sign
        // in with, but escrow never names them by it, so only a user whose wallet is owned by the
        // principal is the offerer
        Ok(local_user_index_canister::c2c_lookup_user::Response::Success(user))
            if UserIdAndPrincipal::new(user.user_id, user.principal).wallet_owner() == principal =>
        {
            Some(user.user_id)
        }
        Ok(_) => None,
        // Failing the call has the escrow canister try again, which is only worth it if the
        // lookup could then succeed
        Err(error) if delay_if_should_retry_failed_c2c_call(&error).is_some() => {
            ic_cdk::trap(format!("Failed to look up the offerer of a P2P swap: {error:?}"))
        }
        Err(error) => {
            error!(?error, %principal, "Failed to look up the offerer of a P2P swap");
            None
        }
    }
}

// Applies the escrow canister's change to a swap's status to the user's copy of the message it was
// offered in, which is in their direct chat with `them`, returning the change to send `them`
pub fn apply_status_change<P: EventPusher>(
    user: &mut User,
    them: UserId,
    args: SwapStatusChange,
    now: TimestampMillis,
    event_pusher: P,
) -> Option<P2PSwapStatusChange> {
    let P2PSwapLocation::Message(m) = args.location else {
        return None;
    };
    let chat = user.direct_chats.get_mut(&them.into())?;
    // Anyone can create a swap in the escrow canister naming any message as its location, so the
    // notification is ignored unless it is for the swap on that message
    let content = chat
        .get_p2p_swap(m.thread_root_message_index, m.message_id)
        .filter(|c| c.swap_id == args.swap_id)?;

    let status = match args.status {
        SwapStatus::Expired(e) => {
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
            // Escrow names the acceptor by the owner of their wallet, which the swap recorded when
            // they reserved it. For a swap reserved before that was recorded, whose acceptor was
            // alone in their canister, the owner is their user id.
            let accepted_by = chat
                .events()
                .p2p_swap_reserved_by(m.thread_root_message_index, m.message_id, c.accepted_by)
                .unwrap_or(c.accepted_by.into());
            let result = chat
                .complete_p2p_swap(
                    accepted_by,
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
    Some(P2PSwapStatusChange {
        thread_root_message_id,
        message_id: m.message_id,
        status,
    })
}
