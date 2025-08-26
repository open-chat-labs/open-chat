use crate::guards::caller_is_notification_pusher;
use crate::{RuntimeState, read_state};
use ic_cdk::query;
use local_user_index_canister::notifications::{Response::*, *};
use std::collections::HashMap;
use types::{NotificationEnvelope, NotificationSubscription, UserId};

const ONE_MB: usize = 1024 * 1024;

#[query(guard = "caller_is_notification_pusher")]
fn notifications(args: Args) -> Response {
    read_state(|state| notifications_impl(args, state))
}

pub(crate) fn notifications_impl(args: Args, state: &RuntimeState) -> Response {
    let mut notifications = Vec::new();
    let mut subscriptions = HashMap::new();
    let mut bot_endpoints = HashMap::new();
    let mut approx_response_size = 0;

    for notification in state.data.notifications.iter(args.from_notification_index) {
        let mut has_subscriptions = false;
        let mut size_added_by_notification = notification.value.approx_size();

        match &notification.value {
            NotificationEnvelope::User(n) => {
                for user_id in n.recipients.iter() {
                    // Get web push and firebase subscriptions for the user
                    let notification_subscriptions = get_notification_subscriptions(user_id, state);
                    has_subscriptions |= !notification_subscriptions.is_empty();

                    // If user's subscriptions are already processed, skip them
                    if !subscriptions.contains_key(user_id) {
                        size_added_by_notification += notification_subscriptions
                            .iter()
                            .map(|s| match s {
                                NotificationSubscription::WebPush(web_push) => web_push.approx_size(),
                                // TODO add FCM push size calculation
                                _ => 0,
                            })
                            .sum::<usize>();

                        subscriptions.insert(*user_id, notification_subscriptions);
                    }

                    if size_added_by_notification > ONE_MB {
                        break;
                    }
                }
            }
            NotificationEnvelope::Bot(n) => {
                let mut bots_to_add: Vec<(UserId, String)> = Vec::new();
                for bot_id in n.recipients.keys() {
                    if let Some(bot) = state.data.bots.get(bot_id) {
                        has_subscriptions = true;
                        if !bot_endpoints.contains_key(bot_id) {
                            size_added_by_notification += bot_id.as_slice().len() + bot.endpoint.len() + 5;
                            bots_to_add.push((*bot_id, bot.endpoint.clone()));
                        }
                    }
                    if size_added_by_notification > ONE_MB {
                        break;
                    }
                }
                bot_endpoints.extend(bots_to_add);
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

fn get_notification_subscriptions(user_id: &UserId, state: &RuntimeState) -> Vec<NotificationSubscription> {
    let mut web_push_subs_for_user: Vec<NotificationSubscription> = state
        .data
        .web_push_subscriptions
        .get(user_id)
        .unwrap_or_default()
        .into_iter()
        .map(NotificationSubscription::WebPush)
        .collect();

    let fcm_tokens_for_user: Vec<NotificationSubscription> = state
        .data
        .fcm_token_store
        .get_for_user(user_id)
        .into_iter()
        .map(|t| NotificationSubscription::FcmPush(t.clone()))
        .collect();

    web_push_subs_for_user.extend(fcm_tokens_for_user);
    web_push_subs_for_user
}
