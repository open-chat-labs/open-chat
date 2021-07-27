use crate::dynamodb::DynamoDbClient;
use crate::ic_agent::IcAgent;
use crate::read_env_var;
use futures::future;
use lambda_runtime::Error;
use shared::types::indexed_event::IndexedEvent;
use shared::types::notifications::Notification;
use shared::types::{CanisterId, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use web_push::{
    ContentEncoding, SubscriptionInfo, SubscriptionKeys, VapidSignatureBuilder, WebPushClient, WebPushMessageBuilder,
};

pub async fn run(canister_id: CanisterId) -> Result<(), Error> {
    let dynamodb_client = DynamoDbClient::build();

    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let ic_agent = IcAgent::build(&ic_identity_pem)?;

    let vapid_private_key = read_env_var("VAPID_PRIVATE_KEY")?;

    let from_notification_index = dynamodb_client
        .get_notification_index_processed_up_to(canister_id)
        .await?
        .map_or(0, |i| i + 1);

    let ic_response = ic_agent.get_notifications(canister_id, from_notification_index).await?;

    if let Some(latest_notification_index) = ic_response.notifications.last().map(|e| e.index) {
        let subscriptions_map = ic_response
            .subscriptions
            .into_iter()
            .map(|(k, v)| (k, v.into_iter().map(convert_subscription_info).collect()))
            .collect();

        handle_notifications(ic_response.notifications, subscriptions_map, vapid_private_key.as_bytes()).await?;

        dynamodb_client
            .set_notification_index_processed_up_to(canister_id, latest_notification_index)
            .await?;
    }

    Ok(())
}

async fn handle_notifications(
    notifications: Vec<IndexedEvent<Notification>>,
    mut subscriptions: HashMap<UserId, Vec<SubscriptionInfo>>,
    vapid_private_key: &[u8],
) -> Result<(), Error> {
    let grouped_by_user = group_notifications_by_user(notifications);

    let client = WebPushClient::new();

    let mut futures = Vec::new();
    for (user_id, notifications) in grouped_by_user.into_iter() {
        if let Some(s) = subscriptions.remove(&user_id) {
            futures.push(push_notifications_to_user(&client, vapid_private_key, notifications, s));
        }
    }
    future::join_all(futures).await;
    Ok(())
}

fn group_notifications_by_user(notifications: Vec<IndexedEvent<Notification>>) -> HashMap<UserId, Vec<Notification>> {
    let mut grouped_by_user: HashMap<UserId, Vec<Notification>> = HashMap::new();

    fn assign_notification_to_user(map: &mut HashMap<UserId, Vec<Notification>>, user_id: UserId, notification: Notification) {
        match map.entry(user_id) {
            Occupied(e) => e.into_mut().push(notification),
            Vacant(e) => {
                e.insert(vec![notification]);
            }
        };
    }

    for n in notifications.into_iter() {
        match &n.value {
            Notification::DirectMessageNotification(d) => {
                assign_notification_to_user(&mut grouped_by_user, d.recipient, n.value.clone());
            }
            Notification::GroupMessageNotification(g) => {
                for u in g.recipients.iter() {
                    assign_notification_to_user(&mut grouped_by_user, *u, n.value.clone());
                }
            }
        }
    }

    grouped_by_user
}

async fn push_notifications_to_user(
    client: &WebPushClient,
    vapid_private_key: &[u8],
    notifications: Vec<Notification>,
    subscriptions: Vec<SubscriptionInfo>,
) -> Result<(), Error> {
    let serialized = serde_json::to_string(&notifications)?;

    let mut messages = Vec::with_capacity(subscriptions.len());
    for subscription in subscriptions.into_iter() {
        let sig_builder = VapidSignatureBuilder::from_pem(vapid_private_key, &subscription)?;

        let mut builder = WebPushMessageBuilder::new(&subscription)?;
        builder.set_payload(ContentEncoding::AesGcm, serialized.as_bytes());
        builder.set_vapid_signature(sig_builder.build()?);
        messages.push(builder.build()?);
    }

    let futures: Vec<_> = messages.into_iter().map(|m| client.send(m)).collect();

    futures::future::join_all(futures).await;

    Ok(())
}

fn convert_subscription_info(value: notifications_canister::common::subscription::SubscriptionInfo) -> SubscriptionInfo {
    SubscriptionInfo {
        endpoint: value.endpoint,
        keys: SubscriptionKeys {
            p256dh: value.keys.p256dh,
            auth: value.keys.auth,
        },
    }
}
