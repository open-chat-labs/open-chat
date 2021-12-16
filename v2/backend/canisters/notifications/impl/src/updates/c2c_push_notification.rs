use crate::{RuntimeState, MAX_SUBSCRIPTION_AGE, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::c2c_push_notification::{Response::*, *};
use types::{Notification, NotificationEnvelope, UserId};

#[update]
#[trace]
fn c2c_push_notification(args: Args) -> Response {
    RUNTIME_STATE
        .with(|state| c2c_push_notification_impl(args.recipients, args.notification, state.borrow_mut().as_mut().unwrap()))
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
