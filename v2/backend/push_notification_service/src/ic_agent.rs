use candid::{CandidType, Decode, Encode};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use lambda_runtime::Error;
use serde::Deserialize;
use shared::types::push_notifications::IndexedNotification;
use shared::types::{CanisterId, UserId};
use std::collections::HashMap;

const IC_URL: &str = "https://ic0.app";

pub struct IcAgent {
    agent: Agent,
}

impl IcAgent {
    pub fn build(pem: &str) -> Result<IcAgent, Error> {
        let transport = ReqwestHttpReplicaV2Transport::create(IC_URL.to_string())?;
        let timeout = std::time::Duration::from_secs(60 * 5);

        let agent = Agent::builder()
            .with_transport(transport)
            .with_boxed_identity(Self::get_identity(pem))
            .with_ingress_expiry(Some(timeout))
            .build()?;

        Ok(IcAgent { agent })
    }

    pub async fn get_notifications(
        &self,
        canister_id: CanisterId,
        from_notification_index: u64,
    ) -> Result<GetNotificationsSuccessResult, Error> {
        let args = GetNotificationsArgs { from_notification_index };

        let response = self
            .agent
            .query(&canister_id, "get_notifications")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, GetNotificationsResponse)? {
            GetNotificationsResponse::Success(result) => Ok(result),
            GetNotificationsResponse::NotAuthorized => Err("Not authorized".into()),
        }
    }

    /// Returns an identity derived from the private key.
    fn get_identity(pem: &str) -> Box<dyn Identity + Sync + Send> {
        match BasicIdentity::from_pem(pem.as_bytes()) {
            Ok(identity) => Box::new(identity),
            Err(error) => {
                eprintln!(
                    "Couldn't load identity from PEM file. {:?}. Input: {:?}",
                    error,
                    pem.as_bytes()
                );
                std::process::exit(1);
            }
        }
    }
}

#[derive(CandidType, Deserialize)]
pub struct GetNotificationsArgs {
    from_notification_index: u64,
}

#[derive(CandidType, Deserialize)]
pub enum GetNotificationsResponse {
    Success(GetNotificationsSuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize)]
pub struct GetNotificationsSuccessResult {
    pub notifications: Vec<IndexedNotification>,
    pub subscriptions: HashMap<UserId, Vec<String>>,
}
