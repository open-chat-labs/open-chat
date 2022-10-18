use crate::sms_reader::SmsReader;
use async_trait::async_trait;
use candid::{Decode, Encode};
use garcon::ThrottleWaiter;
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use std::time::Duration;
use tracing::error;
use types::{CanisterId, Error};

pub struct IcAgentConfig {
    pub ic_url: String,
    pub ic_identity_pem: String,
    pub fetch_root_key: bool,
    pub canister_id: CanisterId,
}

pub struct IcAgent {
    agent: Agent,
    canister_id: CanisterId,
}

impl IcAgent {
    pub async fn build(config: &IcAgentConfig) -> Result<IcAgent, Error> {
        let transport = ReqwestHttpReplicaV2Transport::create(&config.ic_url)?;
        let timeout = std::time::Duration::from_secs(60 * 5);

        let agent = Agent::builder()
            .with_transport(transport)
            .with_boxed_identity(Self::get_identity(&config.ic_identity_pem))
            .with_ingress_expiry(Some(timeout))
            .build()?;

        if config.fetch_root_key {
            agent.fetch_root_key().await?;
        }

        Ok(IcAgent {
            agent,
            canister_id: config.canister_id,
        })
    }

    /// Returns an identity derived from the private key.
    fn get_identity(pem: &str) -> Box<dyn Identity + Sync + Send> {
        match BasicIdentity::from_pem(pem.as_bytes()) {
            Ok(identity) => Box::new(identity),
            Err(error) => {
                error!("Couldn't load identity from PEM file. {error:?}. Input: {:?}", pem.as_bytes());
                std::process::exit(1);
            }
        }
    }
}

#[async_trait]
impl SmsReader for IcAgent {
    async fn get(&self, from_index: u64) -> Result<user_index_canister::sms_messages::SuccessResult, Error> {
        let args = user_index_canister::sms_messages::Args { from_index };

        let response = self
            .agent
            .query(&self.canister_id, "sms_messages")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        let user_index_canister::sms_messages::Response::Success(result) =
            Decode!(&response, user_index_canister::sms_messages::Response)?;

        Ok(result)
    }

    async fn remove(&self, up_to_index: u64) -> Result<(), Error> {
        let args = user_index_canister::remove_sms_messages::Args { up_to_index };

        let request_id = self
            .agent
            .update(&self.canister_id, "remove_sms_messages")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        let waiter = ThrottleWaiter::new(Duration::from_secs(1));
        let response_bytes = self.agent.wait(request_id, self.canister_id, waiter).await?;

        let user_index_canister::remove_sms_messages::Response::Success =
            Decode!(&response_bytes, user_index_canister::remove_sms_messages::Response)?;

        Ok(())
    }
}
