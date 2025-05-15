use crate::guards::{caller_is_local_community_canister, caller_is_local_group_canister};
use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use local_user_index_canister::GroupEvent;
use local_user_index_canister::c2c_group_canister::*;
use std::cell::LazyCell;
use std::collections::HashSet;
use types::{BotNotificationEnvelope, Notification, NotificationEnvelope, TimestampMillis, UserNotificationEnvelope};

#[update(guard = "caller_is_local_group_canister", msgpack = true)]
#[trace]
fn c2c_group_canister(args: Args) -> Response {
    mutate_state(|state| c2c_group_or_community_canister_impl(args, true, state))
}

#[update(guard = "caller_is_local_community_canister", msgpack = true)]
#[trace]
fn c2c_community_canister(
    args: local_user_index_canister::c2c_community_canister::Args,
) -> local_user_index_canister::c2c_community_canister::Response {
    mutate_state(|state| c2c_group_or_community_canister_impl(args, false, state))
}

fn c2c_group_or_community_canister_impl(args: Args, is_group: bool, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(caller, is_group, event.value, &now, state);
        }
    }
    Response::Success
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    caller: Principal,
    is_group: bool,
    event: GroupEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        GroupEvent::MarkActivity(timestamp) => {
            if is_group {
                state.data.local_groups.mark_activity(&caller.into(), timestamp);
            } else {
                state.data.local_communities.mark_activity(&caller.into(), timestamp);
            }
        }
        GroupEvent::EventStoreEvent(event) => state.data.event_store_client.push(event),
        GroupEvent::Notification(notification) => match notification {
            Notification::User(user_notification) => {
                let users_who_have_blocked_sender: HashSet<_> = user_notification
                    .sender
                    .map(|s| state.data.blocked_users.all_linked_users(s))
                    .unwrap_or_default();

                let filtered_recipients: Vec<_> = user_notification
                    .recipients
                    .into_iter()
                    .filter(|u| {
                        state.data.notification_subscriptions.any_for_user(u) && !users_who_have_blocked_sender.contains(u)
                    })
                    .collect();

                if !filtered_recipients.is_empty() {
                    state
                        .data
                        .notifications
                        .add(NotificationEnvelope::User(UserNotificationEnvelope {
                            recipients: filtered_recipients,
                            notification_bytes: user_notification.notification_bytes.clone(),
                            timestamp: **now,
                        }));
                }
            }
            Notification::Bot(mut bot_notification) => {
                bot_notification.recipients.retain(|b| state.data.bots.exists(b));

                if !bot_notification.recipients.is_empty() {
                    state
                        .data
                        .notifications
                        .add(NotificationEnvelope::Bot(BotNotificationEnvelope {
                            event_type: bot_notification.event_type,
                            recipients: bot_notification.recipients,
                            chat: bot_notification.chat,
                            thread: bot_notification.thread,
                            event_index: bot_notification.event_index,
                            latest_event_index: bot_notification.latest_event_index,
                            timestamp: **now,
                        }));
                }
            }
        },
    }
}
