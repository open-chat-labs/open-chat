use crate::guards::caller_is_escrow_canister;
use crate::{MultiUserEventPusher, RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::c2c_escrow::*;
use escrow_canister::{EscrowEvent, SwapStatusChange};
use multi_user_canister::UserCanisterEvent;
use types::{Chat, P2PSwapLocation, SuccessOnly, UserId};
use user_core::updates::c2c_notify_p2p_swap_status_change::{apply_status_change, offerer_user_id};

// Must be fed by a single queue on the Escrow canister: the idempotency check keeps one high-water
// mark per sender, so a batch retried from a second queue after a later batch from the first had
// landed would be dropped as already seen
#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
async fn c2c_escrow(args: Args) -> Response {
    execute_update_async(|| c2c_escrow_impl(args)).await
}

// Each event is resolved first, which can await a lookup in the LocalUserIndex, and only then checked
// and applied, together in one synchronous step. The lookup traps on a failure worth retrying, so
// that the escrow canister sends the batch again: had the event been checked first, it would be left
// marked as seen but never applied. A copy of the batch sent meanwhile can't apply anything twice, as
// each event is checked and applied together.
async fn c2c_escrow_impl(args: Args) -> Response {
    for event in args.events {
        let (created_at, idempotency_id) = (event.created_at, event.idempotency_id);
        match event.value {
            EscrowEvent::SwapStatusChanged(change) => {
                let resolved = resolve(&change).await;
                mutate_state(|state| {
                    let caller = state.env.caller();
                    if state.data.idempotency_checker.check(caller, created_at, idempotency_id)
                        && let Some((recipient_index, other)) = resolved
                    {
                        apply(change, recipient_index, other, state);
                    }
                });
            }
        }
    }
    SuccessOnly::Success
}

// For a swap offered in a direct chat: the user whose copy of the message records the change, and the
// other user in the chat, who is sent it. This can await a lookup of the offerer in the LocalUserIndex,
// which traps on a failure worth retrying, so that the escrow canister sends the change again.
async fn resolve(args: &SwapStatusChange) -> Option<(u16, UserId)> {
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

// Records the change in the recipient's copy of the message and sends it to the other user
fn apply(args: SwapStatusChange, recipient_index: u16, other: UserId, state: &mut RuntimeState) {
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
