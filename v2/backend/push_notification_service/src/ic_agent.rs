use candid::{CandidType, Decode, Encode};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use lambda_runtime::Error;
use serde::Deserialize;
use shared::types::notifications::IndexedEvent;
use shared::types::CanisterId;

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

    pub async fn get_events(&self, canister_id: CanisterId, from_event_index: u64) -> Result<Vec<IndexedEvent>, Error> {
        let args = GetEventsArgs { from_event_index };

        let response = self
            .agent
            .query(&canister_id, "get_events")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, GetEventsResponse)? {
            GetEventsResponse::Success(result) => Ok(result.events),
            GetEventsResponse::NotAuthorized => Err("not authorized".into()),
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
