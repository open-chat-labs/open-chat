use crate::{Data, RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_canister::c2c_push_notifications::{Response::*, *};
use serde_bytes::ByteBuf;
use std::collections::HashSet;
use types::{
    BotNotification, BotNotificationEnvelope, CanPushNotificationsArgs, CanPushNotificationsResponse, CanisterId,
    IdempotentEnvelope, Notification, NotificationEnvelope, TimestampMillis, UserId, UserNotificationEnvelope,
};

#[update(msgpack = true)]
#[trace]
async fn c2c_push_notifications(args: Args) -> Response {
    match verify_caller().await {
        Ok(caller) => mutate_state(|state| c2c_push_notifications_impl(caller, args.notifications, state)),
        Err(response) => response,
    }
}

pub(crate) async fn verify_caller() -> Result<Principal, Response> {
    match read_state(can_push_notifications) {
        CanPushNotificationsResult::Authorized(caller) => Ok(caller),
        CanPushNotificationsResult::Blocked => Err(Blocked),
        CanPushNotificationsResult::Unknown(caller, authorizer) => {
            match c2c_can_push_notifications(authorizer, &CanPushNotificationsArgs { principal: caller }).await {
                Ok(CanPushNotificationsResponse::Success(authorized)) => {
                    mutate_state(|state| state.data.authorized_principals.add_principal(caller, authorized));
                    if authorized { Ok(caller) } else { Err(Blocked) }
                }
                Err(error) => Err(InternalError(format!("{:?}", error))),
            }
        }
    }
}

enum CanPushNotificationsResult {
    Authorized(Principal), // (Caller)
    Blocked,
    Unknown(Principal, CanisterId), // (Caller, LocalUserIndex)
}

fn can_push_notifications(state: &RuntimeState) -> CanPushNotificationsResult {
    let caller = state.env.caller();
    match state.data.authorized_principals.can_push_notifications(&caller) {
        Some(true) => CanPushNotificationsResult::Authorized(caller),
        Some(false) => CanPushNotificationsResult::Blocked,
        None => CanPushNotificationsResult::Unknown(caller, state.data.local_user_index_canister_id),
    }
}

fn c2c_push_notifications_impl(
    caller: Principal,
    notifications: Vec<IdempotentEnvelope<Notification>>,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();
    for notification in notifications {
        if state
            .data
            .idempotency_checker
            .check(caller, notification.created_at, notification.idempotency_id)
        {
            match notification.value {
                Notification::User(n) => {
                    push_user_notification(n.sender, n.recipients, n.notification_bytes, now, &mut state.data);
                }
                Notification::Bot(n) => push_bot_notification(n, now, &mut state.data),
            }
        }
    }
    Success
}

pub(crate) fn push_user_notification(
    sender: Option<UserId>,
    recipients: Vec<UserId>,
    notification_bytes: ByteBuf,
    now: TimestampMillis,
    data: &mut Data,
) {
    let users_who_have_blocked_sender: HashSet<_> = sender.map(|s| data.blocked_users.all_linked_users(s)).unwrap_or_default();

    let filtered_recipients: Vec<_> = recipients
        .into_iter()
        .filter(|u| data.subscriptions.any_for_user(u) && !users_who_have_blocked_sender.contains(u))
        .collect();

    if !filtered_recipients.is_empty() {
        data.notifications.add(NotificationEnvelope::User(UserNotificationEnvelope {
            recipients: filtered_recipients,
            notification_bytes: notification_bytes.clone(),
            timestamp: now,
        }));
    }
}

fn push_bot_notification(mut notification: BotNotification, now: TimestampMillis, data: &mut Data) {
    notification.recipients.retain(|r| data.bot_endpoints.contains_key(r));

    if !notification.recipients.is_empty() {
        data.notifications.add(NotificationEnvelope::Bot(BotNotificationEnvelope {
            event_type: notification.event_type,
            recipients: notification.recipients,
            chat: notification.chat,
            thread: notification.thread,
            event_index: notification.event_index,
            latest_event_index: notification.latest_event_index,
            timestamp: now,
        }));
    }
}

mod c2c_can_push_notifications {
    use types::{CanPushNotificationsArgs, CanPushNotificationsResponse};

    pub type Args = CanPushNotificationsArgs;
    pub type Response = CanPushNotificationsResponse;
}

canister_client::generate_c2c_call!(c2c_can_push_notifications);
