use candid::{Decode, Encode};
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use lambda_runtime::Error;
use notifications_canister::queries::notifications;
use notifications_canister::updates::remove_notifications;
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

    pub async fn get_notifications(
        &self,
        canister_id: CanisterId,
        from_notification_index: u64,
    ) -> Result<notifications::SuccessResult, Error> {
        let args = notifications::Args { from_notification_index };

        let response = self
            .agent
            .query(&canister_id, "notifications")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, notifications::Response)? {
            notifications::Response::Success(result) => Ok(result),
            notifications::Response::NotAuthorized => Err("Not authorized".into()),
        }
    }

    pub async fn remove_notifications(&self, canister_id: CanisterId, up_to_notification_index: u64) -> Result<(), Error> {
        let args = notifications_canister::updates::remove_notifications::Args {
            up_to_notification_index,
        };

        let response = self
            .agent
            .query(&canister_id, "remove_notifications")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        match Decode!(&response, remove_notifications::Response)? {
            remove_notifications::Response::Success => Ok(()),
            remove_notifications::Response::NotAuthorized => Err("Not authorized".into()),
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
