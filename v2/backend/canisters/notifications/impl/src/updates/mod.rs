use crate::{RuntimeState, MAX_SUBSCRIPTION_AGE};
use types::{Notification, NotificationEnvelope, UserId};

mod c2c_push_added_to_group_notification;
mod c2c_push_direct_message_notification;
mod c2c_push_group_message_notification;
mod push_subscription;
mod remove_notifications;
mod remove_subscription;
mod remove_subscriptions;
mod remove_subscriptions_for_user;
mod wallet_receive;

fn c2c_push_notification_impl(recipients: Vec<UserId>, notification: Notification, runtime_state: &mut RuntimeState) {
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
}
