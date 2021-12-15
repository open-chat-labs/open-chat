use crate::ic_agent::IcAgent;
use crate::ic_agent::IcAgentConfig;
use candid::Encode;
use futures::future;
use index_store::IndexStore;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use std::rc::Rc;
use tracing::error;
use types::{Error, IndexedEvent, NotificationEnvelope, UserId};
use web_push::*;

pub async fn run<'a>(
    config: &'a IcAgentConfig,
    index_store: &'a dyn IndexStore,
    vapid_private_pem: &'a str,
) -> Result<(), Error> {
    let ic_agent = IcAgent::build(config).await?;
    let from_notification_index = index_store.get().await?.map_or(0, |i| i + 1);

    let ic_response = ic_agent.get_notifications(from_notification_index).await?;

    if let Some(latest_notification_index) = ic_response.notifications.last().map(|e| e.index) {
        let subscriptions_map = ic_response
            .subscriptions
            .into_iter()
            .map(|(k, v)| (k, v.into_iter().map(convert_subscription_info).collect()))
            .collect();

        let subscriptions_to_remove =
            handle_notifications(ic_response.notifications, subscriptions_map, vapid_private_pem).await;

        let future1 = index_store.set(latest_notification_index);
        let future2 = ic_agent.remove_subscriptions(subscriptions_to_remove);

        let (result1, result2) = futures::future::join(future1, future2).await;

        if result1.is_err() {
            return result1;
        }
        if result2.is_err() {
            return result2;
        }
    }

    Ok(())
}

async fn handle_notifications(
    envelopes: Vec<IndexedEvent<NotificationEnvelope>>,
    mut subscriptions: HashMap<UserId, Vec<SubscriptionInfo>>,
    vapid_private_pem: &str,
) -> HashMap<UserId, Vec<String>> {
    let grouped_by_user = group_notifications_by_user(envelopes);

    let client = WebPushClient::new();

    let mut futures = Vec::new();
    for (user_id, notifications) in grouped_by_user.into_iter() {
        if let Some(s) = subscriptions.remove(&user_id) {
            futures.push(push_notifications_to_user(
                user_id,
                &client,
                vapid_private_pem,
                notifications,
                s,
            ));
        }
    }

    let results = future::join_all(futures).await;

    let mut subscriptions_to_remove_by_user = HashMap::new();

    for result in results {
        match result {
            Err(error) => {
                error!(?error, "Failed to push notifications");
            }
            Ok((user_id, subscriptions_to_remove)) => {
                if !subscriptions_to_remove.is_empty() {
                    subscriptions_to_remove_by_user.insert(user_id, subscriptions_to_remove);
                }
            }
        }
    }

    subscriptions_to_remove_by_user
}

fn group_notifications_by_user(envelopes: Vec<IndexedEvent<NotificationEnvelope>>) -> HashMap<UserId, Vec<Rc<String>>> {
    let mut grouped_by_user: HashMap<UserId, Vec<Rc<String>>> = HashMap::new();

    fn assign_notification_to_user(map: &mut HashMap<UserId, Vec<Rc<String>>>, user_id: UserId, payload: Rc<String>) {
        match map.entry(user_id) {
            Occupied(e) => e.into_mut().push(payload),
            Vacant(e) => {
                e.insert(vec![payload]);
            }
        };
    }

    for n in envelopes.into_iter() {
        let notification_bytes = Encode!(&n.value.notification).unwrap();
        let base64 = Rc::new(base64::encode(notification_bytes));
        for u in n.value.recipients.into_iter() {
            assign_notification_to_user(&mut grouped_by_user, u, base64.clone());
        }
    }

    grouped_by_user
}

async fn push_notifications_to_user(
    user_id: UserId,
    client: &WebPushClient,
    vapid_private_pem: &str,
    notifications: Vec<Rc<String>>,
    subscriptions: Vec<SubscriptionInfo>,
) -> Result<(UserId, Vec<String>), Error> {
    let mut messages = Vec::with_capacity(subscriptions.len());
    for subscription in subscriptions.iter() {
        for notification in &notifications {
            let sig_builder = VapidSignatureBuilder::from_pem(vapid_private_pem.as_bytes(), subscription)?;
            let vapid_signature = sig_builder.build()?;
            let mut builder = WebPushMessageBuilder::new(subscription)?;
            builder.set_payload(ContentEncoding::AesGcm, notification.as_bytes());
            builder.set_vapid_signature(vapid_signature);
            messages.push(builder.build()?);
        }
    }

    let futures: Vec<_> = messages.into_iter().map(|m| client.send(m)).collect();
    let results = futures::future::join_all(futures).await;

    let mut subscriptions_to_remove = Vec::new();
    for index in 0..subscriptions.len() {
        let result = &results[index];
        match result {
            Ok(_) => (),
            Err(error) => match error {
                WebPushError::EndpointNotValid | WebPushError::InvalidUri | WebPushError::EndpointNotFound => {
                    let subscription_key = subscriptions[index].keys.p256dh.clone();
                    subscriptions_to_remove.push(subscription_key);
                }
                _ => {
                    error!(?error, "Failed to push notification");
                }
            },
        }
    }

    Ok((user_id, subscriptions_to_remove))
}

fn convert_subscription_info(value: types::SubscriptionInfo) -> SubscriptionInfo {
    SubscriptionInfo {
        endpoint: value.endpoint,
        keys: SubscriptionKeys {
            p256dh: value.keys.p256dh,
            auth: value.keys.auth,
        },
    }
}
