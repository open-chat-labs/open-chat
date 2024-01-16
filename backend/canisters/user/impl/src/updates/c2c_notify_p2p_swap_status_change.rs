use crate::guards::caller_is_escrow_canister;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use escrow_canister::{SwapStatus, SwapStatusChange as Args};
use types::{Chat, CompleteP2PSwapResult, P2PSwapLocation, P2PSwapStatus, TransactionId};
use user_canister::{P2PSwapStatusChange, UserCanisterEvent};

#[update_msgpack(guard = "caller_is_escrow_canister")]
#[trace]
fn c2c_notify_p2p_swap_status_change(args: Args) {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_p2p_swap_status_change_impl(args, state))
}

fn c2c_notify_p2p_swap_status_change_impl(args: Args, state: &mut RuntimeState) {
    let P2PSwapLocation::Message(m) = args.location;

    if let Chat::Direct(user_id) = m.chat {
        if let Some(chat) = state.data.direct_chats.get_mut(&user_id.into()) {
            if let SwapStatus::Completed(c) = args.status {
                if let CompleteP2PSwapResult::Success(status) = chat.events.complete_p2p_swap(
                    c.accepted_by,
                    m.thread_root_message_index,
                    m.message_id,
                    TransactionId {
                        index: c.token0_transfer_out.block_index,
                        hash: None,
                    },
                    TransactionId {
                        index: c.token1_transfer_out.block_index,
                        hash: None,
                    },
                    state.env.now(),
                ) {
                    state.data.user_canister_events_queue.push(
                        user_id.into(),
                        UserCanisterEvent::P2PSwapStatusChange(Box::new(P2PSwapStatusChange {
                            message_id: m.message_id,
                            status: P2PSwapStatus::Completed(status),
                        })),
                    );
                    crate::jobs::push_user_canister_events::start_job_if_required(state);
                }
            }
        }
    }
}
