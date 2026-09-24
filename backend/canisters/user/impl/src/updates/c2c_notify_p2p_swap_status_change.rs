use crate::guards::caller_is_escrow_canister;
use crate::{UserEventPusher, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::SwapStatusChange as Args;
use types::{Chat, P2PSwapLocation, UserId};
use user_canister::UserCanisterEvent;
use user_core::updates::c2c_notify_p2p_swap_status_change::{apply_status_change, offerer_user_id};

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
        read_state(|state| (UserId::from(state.env.canister_id()), state.data.local_user_index_canister_id));

    // The location names the chat as the offerer sees it, so this user's copy of it is with the
    // offerer unless they are the offerer themselves
    let them = if args.offered_by == my_user_id.as_principal() {
        chat_id.into()
    } else {
        match offerer_user_id(args.offered_by, local_user_index_canister_id).await {
            Some(user_id) => user_id,
            None => return,
        }
    };

    mutate_state(|state| {
        let now = state.env.now();
        let event_pusher = UserEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        };
        if let Some(change) = apply_status_change(&mut state.data.user, them, args, now, event_pusher) {
            state.push_user_canister_event(them, UserCanisterEvent::P2PSwapStatusChange(Box::new(change)));
        }
    })
}
