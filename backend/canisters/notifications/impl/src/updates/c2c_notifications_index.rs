use crate::guards::caller_is_notifications_index;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_canister::c2c_notifications_index::{Response::*, *};
use notifications_index_canister::NotificationsIndexEvent;
use stable_memory_map::StableMemoryMap;

#[update(guard = "caller_is_notifications_index", msgpack = true)]
#[trace]
fn c2c_notifications_index(args: Args) -> Response {
    mutate_state(|state| c2c_notifications_index_impl(args, state))
}

fn c2c_notifications_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state.data.idempotency_checker.check(
            state.data.notifications_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            match event.value {
                NotificationsIndexEvent::SubscriptionAdded(s) => {
                    state.data.subscriptions.push(s.user_id, s.subscription);
                }
                NotificationsIndexEvent::SubscriptionRemoved(s) => {
                    state.data.subscriptions.remove(s.user_id, &s.p256dh_key);
                }
                NotificationsIndexEvent::AllSubscriptionsRemoved(u) => {
                    state.data.subscriptions.remove_all(u);
                }
                NotificationsIndexEvent::UserBlocked(user_id, blocked) => {
                    state.data.blocked_users.insert((blocked, user_id), ());
                }
                NotificationsIndexEvent::UserUnblocked(user_id, unblocked) => {
                    state.data.blocked_users.remove(&(unblocked, user_id));
                }
                NotificationsIndexEvent::BotEndpointUpdated(user_id, url) => {
                    state.data.bot_endpoints.insert(user_id, url);
                }
                NotificationsIndexEvent::BotRemoved(user_id) => {
                    state.data.bot_endpoints.remove(&user_id);
                }
            }
        }
    }
    Success
}
