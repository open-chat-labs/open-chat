use crate::guards::caller_is_escrow_canister;
use crate::{MultiUserEventPusher, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::SwapStatusChange as Args;
use types::{Chat, P2PSwapLocation, UserId};
use user_canister::UserCanisterEvent;
use user_core::updates::c2c_notify_p2p_swap_status_change::{apply_status_change, offerer_user_id};

// The User canister's `c2c_notify_p2p_swap_status_change`, for swaps offered in direct chats. The
// escrow canister notifies the canister of the user the swap was offered to, whose copy of the
// message records the change, which is then sent to the offerer as in the User canister.
#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
async fn c2c_notify_p2p_swap_status_change(args: Args) {
    execute_update_async(|| c2c_notify_p2p_swap_status_change_impl(args)).await
}

async fn c2c_notify_p2p_swap_status_change_impl(args: Args) {
    let P2PSwapLocation::Message(m) = &args.location else {
        return;
    };
    // The location names the chat as the offerer sees it, so by the user it was offered to
    let Chat::Direct(chat_id) = m.chat else {
        return;
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

    // The user whose copy records the change, and the other user in the chat, who is sent it
    let (recipient_index, other) = match (local_offered_to, local_offerer) {
        (Some(offered_to_index), Some(offerer_index)) => (offered_to_index, read_state(|state| state.user_id(offerer_index))),
        (Some(offered_to_index), None) => match offerer_user_id(args.offered_by, local_user_index_canister_id).await {
            Some(offerer) => (offered_to_index, offerer),
            None => return,
        },
        // As the User canister does, an offerer who is notified records the change themselves
        (None, Some(offerer_index)) => (offerer_index, offered_to),
        (None, None) => return,
    };

    mutate_state(|state| {
        let now = state.env.now();
        let user_id = state.user_id(recipient_index);
        let event_pusher = MultiUserEventPusher {
            user_id,
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        };
        let migrated_user_ids = &state.data.migrated_user_ids;
        let change = state
            .data
            .users
            .with_user_mut(recipient_index, |user| {
                // The location names the chat by the other user's id when the swap was offered
                let other = user.direct_chats.latest_user_id(other, migrated_user_ids);
                apply_status_change(user, other, args, now, event_pusher).map(|change| (other, change))
            })
            .flatten();
        if let Some((other, change)) = change {
            // The swap has ended, so there is no longer any need to mark it as expired
            state.cancel_mark_p2p_swap_expired_job(recipient_index, change.message_id);
            state.send_user_canister_event(
                recipient_index,
                other,
                UserCanisterEvent::P2PSwapStatusChange(Box::new(change)),
            );
        }
    })
}
