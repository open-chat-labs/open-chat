use crate::guards::caller_is_escrow_canister;
use crate::updates::c2c_user_canister_v2::send_p2p_swap_status_change;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::NullEventPusher;
use escrow_canister::SwapStatusChange as Args;

#[update(guard = "caller_is_escrow_canister", msgpack = true)]
#[trace]
fn c2c_notify_p2p_swap_status_change(args: Args) {
    mutate_state(|state| c2c_notify_p2p_swap_status_change_impl(args, state))
}

fn c2c_notify_p2p_swap_status_change_impl(args: Args, state: &mut RuntimeState) {
    // The escrow canister names the user the swap belongs to, since this canister holds many
    let Some(user_id) = args.user_id else {
        return;
    };
    let Some(user_index) = state.index_of_local_user(user_id) else {
        return;
    };
    let now = state.env.now();
    // TODO: Push the completion to the event store (`UserEventPusher` in the User canister)
    let changed = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            user_core::updates::c2c_notify_p2p_swap_status_change(user, user_id, args, now, NullEventPusher)
        })
        .flatten();
    if let Some((chat_id, change)) = changed {
        send_p2p_swap_status_change(user_index, chat_id.into(), change, state);
    }
}
