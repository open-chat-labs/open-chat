use crate::ConfirmationCodeSms;
use candid::{CandidType, Decode, Encode};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use lambda_runtime::Error;
use serde::Deserialize;
use shared::types::indexed_event::IndexedEvent;
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

    pub async fn get_sms_messages(
        &self,
        canister_id: CanisterId,
        from_index: u64,
    ) -> Result<GetSmsMessagesSuccessResult, Error> {
        let args = GetSmsMessagesArgs { from_index };

        let response = self
            .agent
            .query(&canister_id, "sms_messages")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, GetSmsMessagesResponse)? {
            GetSmsMessagesResponse::Success(result) => Ok(result),
            GetSmsMessagesResponse::NotAuthorized => Err("Not authorized".into()),
        }
    }

    pub async fn remove_sms_messages(&self, canister_id: CanisterId, up_to_index: u64) -> Result<(), Error> {
        let args = RemoveSmsMessagesArgs { up_to_index };

        let response = self
            .agent
            .query(&canister_id, "remove_sms_messages")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, RemoveSmsMessagesResponse)? {
            RemoveSmsMessagesResponse::Success => Ok(()),
            RemoveSmsMessagesResponse::NotAuthorized => Err("Not authorized".into()),
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

#[derive(CandidType)]
struct GetSmsMessagesArgs {
    from_index: u64,
}

#[derive(Deserialize)]
enum GetSmsMessagesResponse {
    Success(GetSmsMessagesSuccessResult),
    NotAuthorized,
}

#[derive(Deserialize)]
pub struct GetSmsMessagesSuccessResult {
    pub messages: Vec<IndexedEvent<ConfirmationCodeSms>>,
}

#[derive(CandidType)]
pub struct RemoveSmsMessagesArgs {
    up_to_index: u64,
}

#[derive(Deserialize)]
pub enum RemoveSmsMessagesResponse {
    Success,
    NotAuthorized,
}
