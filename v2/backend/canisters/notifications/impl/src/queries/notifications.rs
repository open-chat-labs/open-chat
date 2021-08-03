use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::query;
use notifications_canister::common::subscription::SubscriptionInfo;
use notifications_canister::queries::notifications::{Response::*, *};
use shared::types::indexed_event::IndexedEvent;
use shared::types::notifications::Notification;
use shared::types::UserId;
use std::collections::HashMap;
use std::time::Duration;

const MAX_NOTIFICATIONS_PER_BATCH: u32 = 100;
const MAX_SUBSCRIPTION_AGE: Duration = Duration::from_secs(30 * 24 * 60 * 60); // 30 days

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

fn add_subscriptions(notifications: Vec<IndexedEvent<Notification>>, runtime_state: &RuntimeState) -> SuccessResult {
    let now = runtime_state.env.now();

    let mut active_notifications: Vec<IndexedEvent<Notification>> = Vec::new();
    let mut subscriptions: HashMap<UserId, Vec<SubscriptionInfo>> = HashMap::new();

    for n in notifications.into_iter() {
        let mut has_subscriptions = false;
        match &n.value {
            Notification::DirectMessageNotification(d) => {
                if let Some(s) = runtime_state.data.subscriptions.get(&d.recipient, MAX_SUBSCRIPTION_AGE, now) {
                    subscriptions.insert(d.recipient, s);
                    has_subscriptions = true;
                }
            }
            Notification::GroupMessageNotification(g) => {
                for u in g.recipients.iter() {
                    if let Some(s) = runtime_state.data.subscriptions.get(u, MAX_SUBSCRIPTION_AGE, now) {
                        subscriptions.insert(*u, s);
                        has_subscriptions = true;
                    }
                }
            }
            Notification::V1DirectMessageNotification(d) => {
                if let Some(s) = runtime_state.data.subscriptions.get(&d.recipient, MAX_SUBSCRIPTION_AGE, now) {
                    subscriptions.insert(d.recipient, s);
                    has_subscriptions = true;
                }
            }
            Notification::V1GroupMessageNotification(g) => {
                for u in g.recipients.iter() {
                    if let Some(s) = runtime_state.data.subscriptions.get(u, MAX_SUBSCRIPTION_AGE, now) {
                        subscriptions.insert(*u, s);
                        has_subscriptions = true;
                    }
                }
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
