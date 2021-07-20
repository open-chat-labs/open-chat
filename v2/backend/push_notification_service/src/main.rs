mod dynamodb;
mod ic_agent;

use crate::dynamodb::DynamoDbClient;
use crate::ic_agent::IcAgent;
use futures::future;
use lambda_runtime::{handler_fn, Context, Error};
use serde::Deserialize;
use shared::types::push_notifications::{IndexedNotification, Notification};
use shared::types::{CanisterId, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use std::env;

#[derive(Deserialize)]
struct Request {
    canister_id: CanisterId,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = handler_fn(my_handler);
    lambda_runtime::run(func).await?;
    Ok(())
}

async fn my_handler(request: Request, _ctx: Context) -> Result<(), Error> {
    let dynamodb_client = DynamoDbClient::build();

    let ic_identity_pem = read_env_var("IC_IDENTITY_PEM")?;
    let ic_agent = IcAgent::build(&ic_identity_pem)?;

    let from_notification_index = dynamodb_client
        .get_notification_index_processed_up_to(request.canister_id)
        .await?
        .map_or(0, |i| i + 1);
    let get_notifications_response = ic_agent
        .get_notifications(request.canister_id, from_notification_index)
        .await?;

    if let Some(latest_notification_index) = get_notifications_response.notifications.last().map(|e| e.index) {
        handle_notifications(
            get_notifications_response.notifications,
            get_notifications_response.subscriptions,
        )
        .await?;

        dynamodb_client
            .set_notification_index_processed_up_to(request.canister_id, latest_notification_index)
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

fn read_env_var(name: &str) -> Result<String, Error> {
    env::var(name).map_err(|e| format!("Unable to read environment variable: {}. Error: {}", name, e).into())
}
