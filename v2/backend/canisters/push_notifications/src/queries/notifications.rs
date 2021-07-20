use crate::canister::RUNTIME_STATE;
use crate::model::notification::{IndexedNotification, Notification};
use crate::model::runtime_state::RuntimeState;
use crate::queries::notifications::Response::*;
use candid::CandidType;
use ic_cdk_macros::query;
use serde::Deserialize;
use shared::types::UserId;
use std::collections::HashMap;
use std::time::Duration;

const MAX_NOTIFICATIONS_PER_BATCH: u32 = 100;
const MAX_SUBSCRIPTION_AGE: Duration = Duration::from_secs(30 * 24 * 60 * 60); // 30 days

#[derive(CandidType, Deserialize)]
pub struct Args {
    from_notification_index: u64,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    notifications: Vec<IndexedNotification>,
    subscriptions: HashMap<UserId, Vec<String>>,
}

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

fn add_subscriptions(notifications: Vec<IndexedNotification>, runtime_state: &RuntimeState) -> SuccessResult {
    let now = runtime_state.env.now();

    let mut active_notifications: Vec<IndexedNotification> = Vec::new();
    let mut subscriptions: HashMap<UserId, Vec<String>> = HashMap::new();

    for n in notifications.into_iter() {
        let mut has_subscriptions = false;
        match &n.notification {
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
