use crate::guards::caller_is_escrow_canister;
use crate::{MultiUserEventPusher, RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::SwapStatusChange as Args;
use multi_user_canister::UserCanisterEvent;
use types::{Chat, P2PSwapLocation, UserId};
use user_core::updates::c2c_notify_p2p_swap_status_change::{apply_status_change, offerer_user_id};

// For swaps offered in direct chats. The escrow canister notifies the canister of the user the swap
// was offered to, whose copy of the message records the change, which is then sent to the offerer.
#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
async fn c2c_notify_p2p_swap_status_change(args: Args) {
    execute_update_async(|| c2c_notify_p2p_swap_status_change_impl(args)).await
}

async fn c2c_notify_p2p_swap_status_change_impl(args: Args) {
    if let Some((recipient_index, other)) = resolve(&args).await {
        mutate_state(|state| apply(args, recipient_index, other, state));
    }
}

// The user whose copy of the message records the change, and the other user in the chat, who is sent
// it. Shared with `c2c_escrow`. This can await a lookup of the offerer in the LocalUserIndex, which
// traps on a failure worth retrying, so that the escrow canister sends the change again.
pub(crate) async fn resolve(args: &Args) -> Option<(u16, UserId)> {
    let P2PSwapLocation::Message(m) = &args.location else {
        return None;
    };
    // The location names the chat as the offerer sees it, so by the user it was offered to
    let Chat::Direct(chat_id) = m.chat else {
        return None;
    };
    let offered_to = UserId::from(chat_id);

    // A user in this canister holds their funds under their own principal, by which escrow names
    // them as the offerer
    let (local_offerer, local_offered_to, local_user_index_canister_id) = read_state(|state| {
        (
            state.data.users.index_by_principal(&args.offered_by),
            state.index_of_local_user(offered_to),
            state.data.local_user_index_canister_id,
        )
    });

    match (local_offered_to, local_offerer) {
        (Some(offered_to_index), Some(offerer_index)) => {
            Some((offered_to_index, read_state(|state| state.user_id(offerer_index))))
        }
        (Some(offered_to_index), None) => offerer_user_id(args.offered_by, local_user_index_canister_id)
            .await
            .map(|offerer| (offered_to_index, offerer)),
        // An offerer who is notified records the change themselves
        (None, Some(offerer_index)) => Some((offerer_index, offered_to)),
        (None, None) => None,
    }
}

// Shared with `c2c_escrow`
pub(crate) fn apply(args: Args, recipient_index: u16, other: UserId, state: &mut RuntimeState) {
    let thread_root_message_index = match &args.location {
        P2PSwapLocation::Message(m) => m.thread_root_message_index,
        _ => return,
    };
    let now = state.env.now();
    let user_id = state.user_id(recipient_index);
    let event_pusher = MultiUserEventPusher {
        user_id,
        now,
        rng: state.env.rng(),
        queue: &mut state.data.local_user_index_event_sync_queue,
    };
    let change = state
        .data
        .users
        .with_user_mut(recipient_index, |user| {
            apply_status_change(user, other, args, now, event_pusher).map(|change| (other, change))
        })
        .flatten();
    if let Some((other, change)) = change {
        // The swap has ended, so there is no longer any need to mark it as expired
        state.cancel_mark_p2p_swap_expired_job(recipient_index, other, thread_root_message_index, change.message_id);
        state.send_user_canister_event(
            recipient_index,
            other,
            UserCanisterEvent::P2PSwapStatusChange(Box::new(change)),
        );
    }
}
