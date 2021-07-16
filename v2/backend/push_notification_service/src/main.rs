use aws_sdk_dynamodb::model::AttributeValue;
use aws_sdk_dynamodb::{Blob, Client, Credentials, Region};
use candid::{CandidType, Encode};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::{BasicIdentity, Secp256k1Identity};
use ic_agent::{Agent, Identity};
use lambda_runtime::{handler_fn, Context, Error};
use serde::Deserialize;
use shared::types::notifications::IndexedEvent;
use shared::types::CanisterId;
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
    let dynamodb_client = build_dynamodb_client();

    let event_index = get_event_index(&dynamodb_client, request.canister_id).await?;

    let ic_agent = build_ic_agent("abc")?;

    let args = GetEventsArgs {
        from_event_index: event_index,
    };

    let _response = ic_agent
        .query(&request.canister_id, "get_events")
        .with_arg(Encode!(&args)?)
        .call()
        .await?;

    Ok(())
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
