use crate::guards::caller_is_push_service;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use notifications_canister::notifications::{Response::*, *};
use std::collections::HashMap;
use types::{IndexedEvent, NotificationEnvelope, SubscriptionInfo, UserId};

const MAX_NOTIFICATIONS_PER_BATCH: u32 = 100;

#[query(guard = "caller_is_push_service")]
fn notifications(args: Args) -> Response {
    read_state(|state| notifications_impl(args, state))
}

fn notifications_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let notifications = runtime_state
        .data
        .notifications
        .get(args.from_notification_index, MAX_NOTIFICATIONS_PER_BATCH);

    let result = add_subscriptions(notifications, runtime_state);
    Success(result)
}

fn add_subscriptions(notifications: Vec<IndexedEvent<NotificationEnvelope>>, runtime_state: &RuntimeState) -> SuccessResult {
    let mut active_notifications: Vec<IndexedEvent<NotificationEnvelope>> = Vec::new();
    let mut subscriptions: HashMap<UserId, Vec<SubscriptionInfo>> = HashMap::new();

    for n in notifications {
        let mut has_subscriptions = false;

        for u in n.value.recipients.iter() {
            if let Some(s) = runtime_state.data.subscriptions.get(u) {
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
        timestamp: runtime_state.env.now(),
    }
}
