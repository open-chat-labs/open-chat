use crate::guards::caller_is_notifications_index;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use notifications_canister::c2c_sync_index::{Response::*, *};
use notifications_index_canister::NotificationsIndexEvent;

#[update_msgpack(guard = "caller_is_notifications_index")]
#[trace]
fn c2c_sync_index(args: Args) -> Response {
    mutate_state(|state| c2c_sync_index_impl(args, state))
}

fn c2c_sync_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        match event {
            NotificationsIndexEvent::SubscriptionAdded(s) => {
                state.data.subscriptions.push(s.user_id, s.subscription);
            }
            NotificationsIndexEvent::SubscriptionRemoved(s) => {
                state.data.subscriptions.remove(s.user_id, &s.p256dh_key);
            }
            NotificationsIndexEvent::AllSubscriptionsRemoved(u) => {
                state.data.subscriptions.remove_all(u);
            }
        }
    }
    Success
}
