use crate::{mutate_state, RuntimeState, MAX_SUBSCRIPTION_AGE};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use notifications_canister::c2c_push_notification::{Response::*, *};
use types::{Notification, NotificationEnvelope, UserId};

#[update_msgpack]
#[trace]
fn c2c_push_notification(args: Args) -> Response {
    mutate_state(|state| c2c_push_notification_impl(args.recipients, args.notification, state))
}

fn c2c_push_notification_impl(
    recipients: Vec<UserId>,
    notification: Notification,
    runtime_state: &mut RuntimeState,
) -> Response {
    let now = runtime_state.env.now();
    if runtime_state
        .data
        .subscriptions
        .contains_any(&recipients, MAX_SUBSCRIPTION_AGE, now)
    {
        runtime_state.data.notifications.add(NotificationEnvelope {
            recipients,
            notification,
        });
    }
    Success
}
