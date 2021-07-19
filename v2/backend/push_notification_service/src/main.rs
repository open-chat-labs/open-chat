mod dynamodb;
mod ic_agent;

use crate::dynamodb::{DynamoDbClient, DynamoDbClientConfig};
use crate::ic_agent::IcAgent;
use aws_sdk_dynamodb::Region;
use lambda_runtime::{handler_fn, Context, Error};
use serde::Deserialize;
use shared::types::chat_id::{ChatId, DirectChatId};
use shared::types::notifications::Event::*;
use shared::types::notifications::IndexedEvent;
use shared::types::{CanisterId, MessageIndex, UserId};
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
    let dynamodb_client_config = DynamoDbClientConfig {
        region: Region::new(env::var("AWS_REGION")?),
        access_key_id: env::var("AWS_ACCESS_KEY_ID")?,
        secret_key: env::var("AWS_SECRET_KEY")?,
    };
    let dynamodb_client = DynamoDbClient::build(dynamodb_client_config);

    let ic_identity_pem = env::var("IC_IDENTITY_PEM")?;
    let ic_agent = IcAgent::build(&ic_identity_pem)?;

    let event_index = dynamodb_client.get_event_index(request.canister_id).await?;
    let events = ic_agent.get_events(request.canister_id, event_index).await?;

    if let Some(last_event_index) = events.last().map(|e| e.index) {
        handle_events(events, &dynamodb_client).await?;

        dynamodb_client.set_event_index(request.canister_id, last_event_index).await?;
    }

    Ok(())
}

async fn handle_events(events: Vec<IndexedEvent>, dynamodb_client: &DynamoDbClient) -> Result<(), Error> {
    let mut subscriptions = Vec::new();
    let mut notifications: HashMap<UserId, HashMap<ChatId, Vec<MessageIndex>>> = HashMap::new();

    fn add_notification(
        map: &mut HashMap<UserId, HashMap<ChatId, Vec<MessageIndex>>>,
        user_id: UserId,
        chat_id: ChatId,
        message_index: MessageIndex,
    ) {
        match map.entry(user_id) {
            Occupied(e) => {
                match e.into_mut().entry(chat_id) {
                    Occupied(c) => c.into_mut().push(message_index),
                    Vacant(c) => {
                        c.insert(vec![message_index]);
                    }
                };
            }
            Vacant(e) => {
                e.insert([(chat_id, vec![message_index])].iter().cloned().collect());
            }
        };
    }

    for event in events.into_iter().map(|e| e.event) {
        match event {
            Subscription(s) => subscriptions.push(s),
            DirectMessageNotification(n) => {
                let chat_id = ChatId::Direct(DirectChatId::from((&n.sender, &n.recipient)));
                add_notification(&mut notifications, n.recipient, chat_id, n.message_index);
            }
            GroupMessageNotification(n) => {
                for user_id in n.recipients.into_iter() {
                    let chat_id = ChatId::Group(n.chat_id);
                    add_notification(&mut notifications, user_id, chat_id, n.message_index);
                }
            }
        };
    }

    if !subscriptions.is_empty() {
        dynamodb_client.update_subscriptions(subscriptions).await?;
    }

    if !notifications.is_empty() {
        handle_notifications(notifications).await?;
    }

    Ok(())
}

async fn handle_notifications(_notifications: HashMap<UserId, HashMap<ChatId, Vec<MessageIndex>>>) -> Result<(), Error> {
    unimplemented!()
}
