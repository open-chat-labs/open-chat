use candid::{Decode, Encode};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use lambda_runtime::Error;
use shared::types::CanisterId;
use user_index_canister::queries::sms_messages;
use user_index_canister::updates::remove_sms_messages;

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
    ) -> Result<sms_messages::SuccessResult, Error> {
        let args = sms_messages::Args { from_index };

        let response = self
            .agent
            .query(&canister_id, "sms_messages")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, sms_messages::Response)? {
            sms_messages::Response::Success(result) => Ok(result),
            sms_messages::Response::NotAuthorized => Err("Not authorized".into()),
        }
    }

    pub async fn remove_sms_messages(&self, canister_id: CanisterId, up_to_index: u64) -> Result<(), Error> {
        let args = remove_sms_messages::Args { up_to_index };

        let response = self
            .agent
            .query(&canister_id, "remove_sms_messages")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, remove_sms_messages::Response)? {
            remove_sms_messages::Response::Success => Ok(()),
            remove_sms_messages::Response::NotAuthorized => Err("Not authorized".into()),
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
