use crate::{RuntimeState, MAX_SUBSCRIPTION_AGE, RUNTIME_STATE};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use notifications_canister::c2c_push_group_message_notification::{Response::*, *};
use types::{Notification, NotificationEnvelope};

#[update]
#[trace]
fn c2c_push_group_message_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_push_group_message_notification_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_push_group_message_notification_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    if runtime_state
        .data
        .subscriptions
        .contains_any(&args.recipients, MAX_SUBSCRIPTION_AGE, now)
    {
        runtime_state.data.notifications.add(NotificationEnvelope {
            recipients: args.recipients,
            notification: Notification::GroupMessageNotification(args.notification),
        });
    }

    Success
}
