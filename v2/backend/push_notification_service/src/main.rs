use aws_sdk_dynamodb::model::AttributeValue;
use aws_sdk_dynamodb::{Blob, Client, Credentials, Region};
use candid::{CandidType, Decode, Encode};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::{BasicIdentity, Secp256k1Identity};
use ic_agent::{Agent, Identity};
use lambda_runtime::{handler_fn, Context, Error};
use serde::Deserialize;
use shared::types::chat_id::{ChatId, DirectChatId};
use shared::types::notifications::Event::*;
use shared::types::notifications::{IndexedEvent, Subscription};
use shared::types::{CanisterId, MessageIndex, UserId};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use std::env;
use std::str::FromStr;

pub const IC_URL: &str = "https://ic0.app";

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
    let ic_identity_pem = env::var("IC_IDENTITY_PEM")?;
    let dynamodb_client = build_dynamodb_client();
    let ic_agent = build_ic_agent(&ic_identity_pem)?;

    let event_index = get_event_index(&dynamodb_client, request.canister_id).await?;
    let events = get_events(&ic_agent, request.canister_id, event_index).await?;

    if let Some(last_event_index) = events.last().map(|e| e.index) {
        handle_events(events, &dynamodb_client).await?;

        set_event_index(&dynamodb_client, request.canister_id, last_event_index).await?;
    }

    Ok(())
}

async fn get_event_index(dynamodb_client: &Client, canister_id: CanisterId) -> Result<u64, Error> {
    match dynamodb_client
        .get_item()
        .table_name("push_notification_stream_indexes")
        .key("canister_id", AttributeValue::B(Blob::new(canister_id.as_slice().to_vec())))
        .send()
        .await
    {
        Ok(response) => {
            if let Some(item) = response.item {
                let value = item.get("index").unwrap().as_n().unwrap();
                Ok(u64::from_str(value).unwrap())
            } else {
                Err("Value not found".into())
            }
        }
        Err(error) => Err(error.into()),
    }
}

async fn set_event_index(dynamodb_client: &Client, canister_id: CanisterId, event_index: u64) -> Result<(), Error> {
    dynamodb_client
        .put_item()
        .table_name("push_notification_stream_indexes")
        .item("canister_id", AttributeValue::B(Blob::new(canister_id.as_slice().to_vec())))
        .item("index", AttributeValue::N(event_index.to_string()))
        .send()
        .await
        .map(|_| ())
        .map_err(|e| e.into())
}

async fn get_events(ic_agent: &Agent, canister_id: CanisterId, from_event_index: u64) -> Result<Vec<IndexedEvent>, Error> {
    let args = GetEventsArgs { from_event_index };

    let response = ic_agent
        .query(&canister_id, "get_events")
        .with_arg(Encode!(&args)?)
        .call()
        .await?;

    match Decode!(&response, GetEventsResponse)? {
        GetEventsResponse::Success(result) => Ok(result.events),
        GetEventsResponse::NotAuthorized => Err("not authorized".into()),
    }
}

async fn handle_events(events: Vec<IndexedEvent>, dynamodb_client: &Client) -> Result<(), Error> {
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
        update_subscriptions(dynamodb_client, subscriptions).await?;
    }

    if !notifications.is_empty() {
        handle_notifications(notifications).await?;
    }

    Ok(())
}

async fn update_subscriptions(_dynamodb_client: &Client, _subscriptions: Vec<Subscription>) -> Result<(), Error> {
    unimplemented!()
}

async fn handle_notifications(_notifications: HashMap<UserId, HashMap<ChatId, Vec<MessageIndex>>>) -> Result<(), Error> {
    unimplemented!()
}

fn build_dynamodb_client() -> Client {
    let config = aws_sdk_dynamodb::Config::builder()
        .region(Region::new("us-east-1"))
        .credentials_provider(Credentials::from_keys("AKNOTREAL", "NOT_A_SECRET", None))
        .build();

    Client::from_conf(config)
}

fn build_ic_agent(pem: &str) -> Result<Agent, Error> {
    let transport = ReqwestHttpReplicaV2Transport::create(IC_URL.to_string())?;
    let timeout = std::time::Duration::from_secs(60 * 5);

    Agent::builder()
        .with_transport(transport)
        .with_boxed_identity(get_identity(pem))
        .with_ingress_expiry(Some(timeout))
        .build()
        .map_err(|e| e.into())
}

/// Returns an identity derived from the private key.
fn get_identity(pem: &str) -> Box<dyn Identity + Sync + Send> {
    match Secp256k1Identity::from_pem(pem.as_bytes()) {
        Ok(identity) => Box::new(identity),
        Err(_) => match BasicIdentity::from_pem(pem.as_bytes()) {
            Ok(identity) => Box::new(identity),
            Err(_) => {
                eprintln!("Couldn't load identity from PEM file");
                std::process::exit(1);
            }
        },
    }
}

#[derive(CandidType, Deserialize)]
pub struct GetEventsArgs {
    from_event_index: u64,
}

#[derive(CandidType, Deserialize)]
pub enum GetEventsResponse {
    Success(GetEventsSuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize)]
pub struct GetEventsSuccessResult {
    events: Vec<IndexedEvent>,
}
