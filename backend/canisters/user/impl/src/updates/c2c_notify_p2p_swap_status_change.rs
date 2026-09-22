use crate::guards::caller_is_escrow_canister;
use crate::{RuntimeState, UserEventPusher, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use escrow_canister::SwapStatusChange as Args;
use types::UserId;
use user_canister::UserCanisterEvent;

#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
fn c2c_notify_p2p_swap_status_change(args: Args) {
    execute_update(|state| c2c_notify_p2p_swap_status_change_impl(args, state))
}

fn c2c_notify_p2p_swap_status_change_impl(args: Args, state: &mut RuntimeState) {
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    let event_pusher = UserEventPusher {
        now,
        rng: state.env.rng(),
        queue: &mut state.data.local_user_index_event_sync_queue,
    };
    if let Some((chat_id, change)) =
        user_core::updates::c2c_notify_p2p_swap_status_change(&mut state.data.user, my_user_id, args, now, event_pusher)
    {
        state.push_user_canister_event(chat_id.into(), UserCanisterEvent::P2PSwapStatusChange(Box::new(change)));
    }
}
