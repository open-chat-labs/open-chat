use crate::guards::caller_is_notification_pusher;
use crate::{RuntimeState, read_state};
use ic_cdk::query;
use local_user_index_canister::notifications_v2::{Response::*, *};
use std::collections::HashMap;
use types::{NotificationBotDetails, NotificationEnvelope, SubscriptionInfo, UserId};

const ONE_MB: usize = 1024 * 1024;

#[query(guard = "caller_is_notification_pusher")]
fn notifications_v2(args: Args) -> Response {
    read_state(|state| notifications_v2_impl(args, state))
}

fn notifications_v2_impl(args: Args, state: &RuntimeState) -> Response {
    let mut notifications = Vec::new();
    let mut subscriptions = HashMap::new();
    let mut bots = HashMap::new();
    let mut approx_response_size = 0;

    for notification in state.data.notifications.iter(args.from_notification_index) {
        let mut has_subscriptions = false;
        let mut size_added_by_notification = notification.value.approx_size();

        match &notification.value {
            NotificationEnvelope::User(n) => {
                let mut subscriptions_to_add: Vec<(UserId, Vec<SubscriptionInfo>)> = Vec::new();
                for user_id in n.recipients.iter() {
                    if let Some(subscriptions_for_user) = state.data.notification_subscriptions.get(user_id) {
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
                let mut bots_to_add: Vec<(UserId, NotificationBotDetails)> = Vec::new();
                for bot_id in n.recipients.iter() {
                    if let Some(bot) = state.data.bots.get(bot_id) {
                        has_subscriptions = true;
                        if !bots.contains_key(bot_id) {
                            size_added_by_notification += bot_id.as_slice().len() + bot.endpoint.len() + 5;
                            bots_to_add.push((
                                *bot_id,
                                NotificationBotDetails {
                                    endpoint: bot.endpoint.clone(),
                                    data_encoding: bot.data_encoding,
                                },
                            ));
                        }
                    }
                    if size_added_by_notification > ONE_MB {
                        break;
                    }
                }
                bots.extend(bots_to_add);
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
        bots,
        timestamp: state.env.now(),
    })
}
