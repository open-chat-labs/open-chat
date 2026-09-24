use crate::guards::caller_is_escrow_canister;
use crate::{RuntimeState, UserEventPusher, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::{SwapStatus, SwapStatusChange as Args};
use tracing::error;
use types::{
    CanisterId, Chat, ChatId, P2PSwapCancelled, P2PSwapExpired, P2PSwapLocation, P2PSwapStatus, UserId, UserIdAndPrincipal,
};
use user_canister::{P2PSwapStatusChange, UserCanisterEvent};
use utils::canister::delay_if_should_retry_failed_c2c_call;

#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
async fn c2c_notify_p2p_swap_status_change(args: Args) {
    execute_update_async(|| c2c_notify_p2p_swap_status_change_impl(args)).await
}

async fn c2c_notify_p2p_swap_status_change_impl(args: Args) {
    let P2PSwapLocation::Message(m) = &args.location else {
        return;
    };
    let Chat::Direct(chat_id) = m.chat else {
        return;
    };

    let (my_user_id, local_user_index_canister_id) =
        read_state(|state| (state.env.canister_id(), state.data.local_user_index_canister_id));

    // The location names the chat as the offerer sees it, so this user's copy of it is keyed by the
    // offerer unless they are the offerer themselves. Escrow names the offerer by the owner of their
    // wallet: their user id if they are alone in their canister, otherwise their principal, which
    // the LocalUserIndex resolves to their user id.
    let chat_id: ChatId = if args.offered_by == my_user_id {
        chat_id
    } else if UserId::from(args.offered_by).is_canister() {
        args.offered_by.into()
    } else {
        match offerer_user_id(args.offered_by, local_user_index_canister_id).await {
            Some(user_id) => user_id.into(),
            None => return,
        }
    };

    mutate_state(|state| apply_status_change(args, chat_id, state))
}

async fn offerer_user_id(principal: candid::Principal, local_user_index_canister_id: CanisterId) -> Option<UserId> {
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

fn apply_status_change(args: Args, chat_id: ChatId, state: &mut RuntimeState) {
    let P2PSwapLocation::Message(m) = args.location else {
        return;
    };
    if let Some(chat) = state.data.user.direct_chats.get_mut(&chat_id) {
        let mut status_to_push_c2c = None;

        match args.status {
            SwapStatus::Expired(e) => {
                if let Some(content) = chat.get_p2p_swap(m.thread_root_message_index, m.message_id) {
                    let token0_txn_out = e
                        .refunds
                        .into_iter()
                        .find(|t| t.ledger == content.token0.ledger)
                        .map(|t| t.block_index);

                    let status = P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out });

                    if chat
                        .set_p2p_swap_status(m.thread_root_message_index, m.message_id, status.clone(), state.env.now())
                        .is_ok()
                    {
                        status_to_push_c2c = Some(status);
                    }
                }
            }
            SwapStatus::Cancelled(c) => {
                if let Some(content) = chat.get_p2p_swap(m.thread_root_message_index, m.message_id) {
                    let token0_txn_out = c
                        .refunds
                        .into_iter()
                        .find(|t| t.ledger == content.token0.ledger)
                        .map(|t| t.block_index);

                    let status = P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out });

                    if chat
                        .set_p2p_swap_status(m.thread_root_message_index, m.message_id, status.clone(), state.env.now())
                        .is_ok()
                    {
                        status_to_push_c2c = Some(status);
                    }
                }
            }
            SwapStatus::Completed(c) => {
                let now = state.env.now();
                // Escrow names the acceptor by the owner of their wallet, which the swap recorded
                // when they reserved it. For a swap reserved before that was recorded, whose
                // acceptor was alone in their canister, the owner is their user id.
                let accepted_by = chat
                    .events()
                    .p2p_swap_reserved_by(m.thread_root_message_index, m.message_id, c.accepted_by)
                    .unwrap_or(c.accepted_by.into());
                if let Ok(result) = chat.complete_p2p_swap(
                    accepted_by,
                    m.thread_root_message_index,
                    m.message_id,
                    c.token0_transfer_out.block_index,
                    c.token1_transfer_out.block_index,
                    now,
                    UserEventPusher {
                        now,
                        rng: state.env.rng(),
                        queue: &mut state.data.local_user_index_event_sync_queue,
                    },
                ) {
                    status_to_push_c2c = Some(P2PSwapStatus::Completed(result.value));
                }
            }
            _ => {}
        }

        if let Some(status) = status_to_push_c2c
            && let Ok(thread_root_message_id) = chat.thread_root_message_id(m.thread_root_message_index)
        {
            state.push_user_canister_event(
                chat_id.into(),
                UserCanisterEvent::P2PSwapStatusChange(Box::new(P2PSwapStatusChange {
                    thread_root_message_id,
                    message_id: m.message_id,
                    status,
                })),
            );
        }
    }
}
