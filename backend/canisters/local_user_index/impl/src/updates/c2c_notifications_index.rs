use crate::guards::caller_is_notifications_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notifications_index::*;
use notifications_index_canister::NotificationsIndexEvent;

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
            // Subscriptions are held under each user's latest id, but the NotificationsIndex may name a
            // user by an id they've since been migrated from, if it hasn't yet been told of the migration
            let latest = |user_id| state.data.migrated_user_ids.latest(user_id);
            match event.value {
                NotificationsIndexEvent::SubscriptionAdded(s) => {
                    let user_id = latest(s.user_id);
                    state.data.web_push_subscriptions.push(user_id, s.subscription);
                }
                NotificationsIndexEvent::SubscriptionRemoved(s) => {
                    let user_id = latest(s.user_id);
                    state.data.web_push_subscriptions.remove(user_id, &s.endpoint);
                }
                NotificationsIndexEvent::AllSubscriptionsRemoved(u) => {
                    let user_id = latest(u);
                    state.data.web_push_subscriptions.remove_all(user_id);
                }
                NotificationsIndexEvent::SetNotificationPusherPrincipals(principals) => {
                    state.data.notification_pushers = principals;
                }
                NotificationsIndexEvent::FcmTokenAdded(user_id, fcm_token) => {
                    let user_id = latest(user_id);
                    let _ = state.data.fcm_token_store.add(user_id, fcm_token);
                }
                NotificationsIndexEvent::FcmTokenRemoved(user_id, fcm_token) => {
                    let user_id = latest(user_id);
                    let _ = state.data.fcm_token_store.remove(&user_id, &fcm_token);
                }
                NotificationsIndexEvent::UserBlocked(..)
                | NotificationsIndexEvent::UserUnblocked(..)
                | NotificationsIndexEvent::BotEndpointUpdated(..)
                | NotificationsIndexEvent::BotRemoved(..) => {}
            }
        }
    }
    Response::Success
}
