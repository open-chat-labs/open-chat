use crate::guards::caller_is_push_service;
use crate::{read_state, RuntimeState};
use ic_cdk::query;
use notifications_canister::notifications::{Response::*, *};
use std::collections::HashMap;
use types::{IndexedEvent, NotificationEnvelope, SubscriptionInfo, UserId, UserNotificationEnvelope};

const ONE_MB: usize = 1024 * 1024;

#[query(guard = "caller_is_push_service")]
fn notifications(args: Args) -> Response {
    read_state(|state| notifications_impl(args, state))
}

fn notifications_impl(args: Args, state: &RuntimeState) -> Response {
    let mut notifications: Vec<IndexedEvent<UserNotificationEnvelope>> = Vec::new();
    let mut subscriptions: HashMap<UserId, Vec<SubscriptionInfo>> = HashMap::new();
    let mut approx_response_size = 0;

    for notification in state.data.notifications.iter(args.from_notification_index) {
        if let NotificationEnvelope::User(n) = notification.value {
            let mut has_subscriptions = false;
            let mut size_added_by_notification = n.approx_size();
            let mut subscriptions_to_add: Vec<(UserId, Vec<SubscriptionInfo>)> = Vec::new();

            for user_id in n.recipients.iter() {
                if let Some(subscriptions_for_user) = state.data.subscriptions.get(user_id) {
                    has_subscriptions = true;
                    if !subscriptions.contains_key(user_id) {
                        size_added_by_notification += subscriptions_for_user.iter().map(|s| s.approx_size()).sum::<usize>();
                        subscriptions_to_add.push((*user_id, subscriptions_for_user));
                    }
                }
                if size_added_by_notification > ONE_MB {
                    break;
                }
            }

            if !has_subscriptions {
                continue;
            }

            notifications.push(IndexedEvent {
                index: notification.index,
                value: n,
            });
            subscriptions.extend(subscriptions_to_add);
            approx_response_size += size_added_by_notification;

            if approx_response_size > ONE_MB {
                break;
            }
        }
    }

    Success(SuccessResult {
        notifications,
        subscriptions,
        timestamp: state.env.now(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use serde_bytes::ByteBuf;
    use types::{CanisterId, SubscriptionKeys};
    use utils::env::test::TestEnv;

    #[test]
    fn returns_once_1_mb_is_filled() {
        let mut state = RuntimeState::new(Box::<TestEnv>::default(), Data::default());

        let user_id = UserId::from(CanisterId::anonymous());

        state.data.subscriptions.push(
            user_id,
            SubscriptionInfo {
                endpoint: "https://blah.com".to_ascii_lowercase(),
                keys: SubscriptionKeys {
                    p256dh: "1234657890".to_string(),
                    auth: "0987654321".to_string(),
                },
            },
        );

        for _ in 0..1000 {
            state
                .data
                .notifications
                .add(NotificationEnvelope::User(UserNotificationEnvelope {
                    recipients: vec![user_id],
                    notification_bytes: ByteBuf::from([0; 5000]),
                    timestamp: 1,
                }));
        }

        let Success(result) = notifications_impl(
            Args {
                from_notification_index: 0,
            },
            &state,
        );

        assert!(result.notifications.len() > 100);
        assert!(result.notifications.len() < 250);
    }
}
