use crate::guards::caller_is_escrow_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::{SwapStatus, SwapStatusChange as Args};
use types::{Chat, CompleteP2PSwapResult, EventIndex, P2PSwapCancelled, P2PSwapExpired, P2PSwapLocation, P2PSwapStatus};
use user_canister::{P2PSwapStatusChange, UserCanisterEvent};

#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
fn c2c_notify_p2p_swap_status_change(args: Args) {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_p2p_swap_status_change_impl(args, state))
}

fn c2c_notify_p2p_swap_status_change_impl(args: Args, state: &mut RuntimeState) {
    let P2PSwapLocation::Message(m) = args.location;

    if let Chat::Direct(chat_id) = m.chat {
        let my_user_id = state.env.canister_id().into();
        let chat_id = if args.created_by == my_user_id { chat_id } else { args.created_by.into() };

        if let Some(chat) = state.data.direct_chats.get_mut(&chat_id) {
            let mut status_to_push_c2c = None;

            match args.status {
                SwapStatus::Expired(e) => {
                    if let Some(content) =
                        chat.events
                            .get_p2p_swap(m.thread_root_message_index, m.message_id, EventIndex::default())
                    {
                        let token0_txn_out = e
                            .refunds
                            .into_iter()
                            .find(|t| t.ledger == content.token0.ledger)
                            .map(|t| t.block_index);

                        let status = P2PSwapStatus::Expired(P2PSwapExpired { token0_txn_out });

                        chat.events.set_p2p_swap_status(
                            m.thread_root_message_index,
                            m.message_id,
                            status.clone(),
                            state.env.now(),
                        );

                        status_to_push_c2c = Some(status);
                    }
                }
                SwapStatus::Cancelled(c) => {
                    if let Some(content) =
                        chat.events
                            .get_p2p_swap(m.thread_root_message_index, m.message_id, EventIndex::default())
                    {
                        let token0_txn_out = c
                            .refunds
                            .into_iter()
                            .find(|t| t.ledger == content.token0.ledger)
                            .map(|t| t.block_index);

                        let status = P2PSwapStatus::Cancelled(P2PSwapCancelled { token0_txn_out });

                        chat.events.set_p2p_swap_status(
                            m.thread_root_message_index,
                            m.message_id,
                            status.clone(),
                            state.env.now(),
                        );

                        status_to_push_c2c = Some(status);
                    }
                }
                SwapStatus::Completed(c) => {
                    if let CompleteP2PSwapResult::Success(status) = chat.events.complete_p2p_swap(
                        c.accepted_by,
                        m.thread_root_message_index,
                        m.message_id,
                        c.token0_transfer_out.block_index,
                        c.token1_transfer_out.block_index,
                        state.env.now(),
                        &mut state.data.event_store_client,
                    ) {
                        status_to_push_c2c = Some(P2PSwapStatus::Completed(status));
                    }
                }
                _ => {}
            }

            if let Some(status) = status_to_push_c2c {
                let thread_root_message_id = m.thread_root_message_index.map(|i| chat.main_message_index_to_id(i));
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
}
