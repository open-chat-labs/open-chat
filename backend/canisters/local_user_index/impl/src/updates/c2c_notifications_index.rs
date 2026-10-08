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
            // Subscriptions and tokens are added under the user's latest id, since the NotificationsIndex
            // may have sent one before being told of the user's migration, after this LocalUserIndex
            // had already moved theirs onto their new id. Removals aren't mapped, since one for an old
            // id could remove a copy the user has since pushed again under their new id.
            match event.value {
                NotificationsIndexEvent::SubscriptionAdded(s) => {
                    let user_id = state.data.migrated_user_ids.latest(s.user_id);
                    state.data.web_push_subscriptions.push(user_id, s.subscription);
                }
                NotificationsIndexEvent::SubscriptionRemoved(s) => {
                    state.data.web_push_subscriptions.remove(s.user_id, &s.endpoint);
                }
                NotificationsIndexEvent::AllSubscriptionsRemoved(u) => {
                    state.data.web_push_subscriptions.remove_all(u);
                }
                NotificationsIndexEvent::SetNotificationPusherPrincipals(principals) => {
                    state.data.notification_pushers = principals;
                }
                NotificationsIndexEvent::FcmTokenAdded(user_id, fcm_token) => {
                    let user_id = state.data.migrated_user_ids.latest(user_id);
                    let _ = state.data.fcm_token_store.add(user_id, fcm_token);
                }
                NotificationsIndexEvent::FcmTokenRemoved(user_id, fcm_token) => {
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
