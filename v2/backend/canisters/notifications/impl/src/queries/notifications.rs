use crate::{RuntimeState, MAX_SUBSCRIPTION_AGE, RUNTIME_STATE};
use ic_cdk_macros::query;
use notifications_canister::notifications::{Response::*, *};
use std::collections::HashMap;
use types::{IndexedEvent, NotificationEnvelope, SubscriptionInfo, UserId};

const MAX_NOTIFICATIONS_PER_BATCH: u32 = 100;

#[query]
fn notifications(args: Args) -> Response {
    RUNTIME_STATE.with(|state| notifications_impl(args, state.borrow().as_ref().unwrap()))
}

fn notifications_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if runtime_state.is_caller_push_service() {
        let notifications = runtime_state
            .data
            .notifications
            .get(args.from_notification_index, MAX_NOTIFICATIONS_PER_BATCH);

        let result = add_subscriptions(notifications, runtime_state);
        Success(result)
    } else {
        NotAuthorized
    }
}

fn add_subscriptions(notifications: Vec<IndexedEvent<NotificationEnvelope>>, runtime_state: &RuntimeState) -> SuccessResult {
    let now = runtime_state.env.now();

    let mut active_notifications: Vec<IndexedEvent<NotificationEnvelope>> = Vec::new();
    let mut subscriptions: HashMap<UserId, Vec<SubscriptionInfo>> = HashMap::new();

    for n in notifications.into_iter() {
        let mut has_subscriptions = false;

        for u in n.value.recipients.iter() {
            if let Some(s) = runtime_state.data.subscriptions.get(u, MAX_SUBSCRIPTION_AGE, now) {
                subscriptions.insert(*u, s);
                has_subscriptions = true;
            }
        }

        if has_subscriptions {
            active_notifications.push(n);
        }
    }

    SuccessResult {
        notifications: active_notifications,
        subscriptions,
    }
}
