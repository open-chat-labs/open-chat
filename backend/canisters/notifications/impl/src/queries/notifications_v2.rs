use crate::guards::caller_is_push_service;
use crate::{read_state, RuntimeState};
use ic_cdk::query;
use notifications_canister::notifications_v2::{Response::*, *};
use std::collections::HashMap;
use types::{NotificationEnvelope, SubscriptionInfo, UserId};

const ONE_MB: usize = 1024 * 1024;

#[query(guard = "caller_is_push_service")]
fn notifications_v2(args: Args) -> Response {
    read_state(|state| notifications_v2_impl(args, state))
}

fn notifications_v2_impl(args: Args, state: &RuntimeState) -> Response {
    let mut notifications = Vec::new();
    let mut subscriptions = HashMap::new();
    let mut bot_endpoints = HashMap::new();
    let mut approx_response_size = 0;

    for notification in state.data.notifications.iter(args.from_notification_index) {
        let mut has_subscriptions = false;
        let mut size_added_by_notification = notification.value.approx_size();

        match &notification.value {
            NotificationEnvelope::User(n) => {
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
                subscriptions.extend(subscriptions_to_add);
            }
            NotificationEnvelope::Bot(n) => {
                let mut bot_endpoint_to_add: Vec<(UserId, String)> = Vec::new();
                for user_id in n.recipients.iter() {
                    if let Some(endpoint) = state.data.bot_endpoints.get(user_id) {
                        has_subscriptions = true;
                        if !bot_endpoints.contains_key(user_id) {
                            size_added_by_notification += user_id.as_slice().len() + endpoint.len() + 5;
                            bot_endpoint_to_add.push((*user_id, endpoint.clone()));
                        }
                    }
                    if size_added_by_notification > ONE_MB {
                        break;
                    }
                }
                bot_endpoints.extend(bot_endpoint_to_add);
            }
        }

        if has_subscriptions {
            notifications.push(notification);
            approx_response_size += size_added_by_notification;

            if approx_response_size > ONE_MB {
                break;
            }
        }
    }

    Success(SuccessResult {
        notifications,
        subscriptions,
        bot_endpoints,
        timestamp: state.env.now(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use serde_bytes::ByteBuf;
    use types::{CanisterId, SubscriptionKeys, UserNotificationEnvelope};
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

        let Success(result) = notifications_v2_impl(
            Args {
                from_notification_index: 0,
            },
            &state,
        );

        assert!(result.notifications.len() > 100);
        assert!(result.notifications.len() < 250);
    }
}
