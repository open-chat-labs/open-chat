use crate::{RuntimeState, MAX_SUBSCRIPTION_AGE, RUNTIME_STATE};
use ic_cdk_macros::update;
use notifications_canister::updates::push_direct_message_notification::{Response::*, *};
use types::Notification;

#[update]
fn push_direct_message_notification(args: Args) -> Response {
    RUNTIME_STATE.with(|state| push_direct_message_notification_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn push_direct_message_notification_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    if runtime_state
        .data
        .subscriptions
        .contains_any(&[args.notification.recipient], MAX_SUBSCRIPTION_AGE, now)
    {
        runtime_state
            .data
            .notifications
            .add(Notification::DirectMessageNotification(args.notification));
    }

    Success
}
