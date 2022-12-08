use crate::{mutate_state, read_state, RuntimeState, MAX_SUBSCRIPTION_AGE};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use notifications_canister::c2c_push_notification::{Response::*, *};
use types::{CanisterId, NotificationEnvelope, UserId};

#[update_msgpack]
#[trace]
fn c2c_push_notification(args: Args) -> Response {
    match read_state(|state| can_push_notifications(&args, state)) {
        CanPushNotificationsResult::Blocked => return Blocked,
        CanPushNotificationsResult::Unknown(caller, authorizer) => {}
        _ => {}
    }

    mutate_state(|state| c2c_push_notification_impl(args.recipients, args.notification_bytes, state))
}

enum CanPushNotificationsResult {
    Authorized,
    Blocked,
    Unknown(Principal, CanisterId), // (Caller, Authorizer)
}

fn can_push_notifications(args: &Args, runtime_state: &RuntimeState) -> CanPushNotificationsResult {
    let caller = runtime_state.env.caller();
    if let Some(authorized) = runtime_state.data.authorized_principals.can_push_notifications(&caller) {
        if authorized {
            return CanPushNotificationsResult::Authorized;
        }
    } else if let Some(authorizer) = args.authorizer {
        if runtime_state.data.authorized_principals.is_authorizer(&authorizer) {
            return CanPushNotificationsResult::Unknown(caller, authorizer);
        }
    }
    CanPushNotificationsResult::Blocked
}

fn c2c_push_notification_impl(
    recipients: Vec<UserId>,
    notification_bytes: Vec<u8>,
    runtime_state: &mut RuntimeState,
) -> Response {
    let filtered_recipients: Vec<_> = recipients
        .into_iter()
        .filter(|u| runtime_state.data.subscriptions.any_for_user(u))
        .collect();

    if !filtered_recipients.is_empty() {
        runtime_state.data.notifications.add(NotificationEnvelope {
            recipients: filtered_recipients,
            notification_bytes,
        });
    }
    Success
}
