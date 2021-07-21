use crate::dynamodb::DynamoDbClient;
use crate::ic_agent::IcAgent;
use crate::read_env_var;
use futures::future;
use lambda_runtime::Error;
use shared::types::push_notifications::{IndexedNotification, Notification};
use shared::types::{CanisterId, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;

pub async fn run(canister_id: CanisterId) -> Result<(), Error> {
    let dynamodb_client = DynamoDbClient::build();

    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let ic_agent = IcAgent::build(&ic_identity_pem)?;

    let from_notification_index = dynamodb_client
        .get_notification_index_processed_up_to(canister_id)
        .await?
        .map_or(0, |i| i + 1);

    let ic_response = ic_agent.get_notifications(canister_id, from_notification_index).await?;

    if let Some(latest_notification_index) = ic_response.notifications.last().map(|e| e.index) {
        handle_notifications(ic_response.notifications, ic_response.subscriptions).await?;

        dynamodb_client
            .set_notification_index_processed_up_to(canister_id, latest_notification_index)
            .await?;
    }

    Ok(())
}

async fn handle_notifications(
    notifications: Vec<IndexedNotification>,
    mut subscriptions: HashMap<UserId, Vec<String>>,
) -> Result<(), Error> {
    let grouped_by_user = group_notifications_by_user(notifications);

    let mut futures = Vec::new();
    for (user_id, notifications) in grouped_by_user.into_iter() {
        if let Some(s) = subscriptions.remove(&user_id) {
            futures.push(push_notifications_to_user(notifications, s));
        }
    }
    future::join_all(futures).await;
    Ok(())
}

fn group_notifications_by_user(notifications: Vec<IndexedNotification>) -> HashMap<UserId, Vec<Notification>> {
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
        match &n.notification {
            Notification::DirectMessageNotification(d) => {
                assign_notification_to_user(&mut grouped_by_user, d.recipient, n.notification.clone());
            }
            Notification::GroupMessageNotification(g) => {
                for u in g.recipients.iter() {
                    assign_notification_to_user(&mut grouped_by_user, *u, n.notification.clone());
                }
            }
        }
    }

    grouped_by_user
}

async fn push_notifications_to_user(_notifications: Vec<Notification>, _subscriptions: Vec<String>) {
    // TODO
    unimplemented!()
}
