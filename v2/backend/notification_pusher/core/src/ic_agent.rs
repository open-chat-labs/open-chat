use candid::{Decode, Encode};
use garcon::ThrottleWaiter;
use ic_agent::agent::http_transport::ReqwestHttpReplicaV2Transport;
use ic_agent::identity::BasicIdentity;
use ic_agent::{Agent, Identity};
use notifications_canister::{notifications, remove_notifications, remove_subscriptions};
use std::collections::HashMap;
use std::time::Duration;
use tracing::trace;
use types::{CanisterId, Error, UserId};

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

    pub async fn get_notifications(&self, from_notification_index: u64) -> Result<notifications::SuccessResult, Error> {
        let args = notifications::Args { from_notification_index };

        trace!(?args, "notifications::args");

        let response = self
            .agent
            .query(&self.canister_id, "notifications")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        let notifications::Response::Success(result) = Decode!(&response, notifications::Response)?;

        trace!(?result, "notifications::result");

        Ok(result)
    }

    pub async fn remove_notifications(&self, up_to_notification_index: u64) -> Result<(), Error> {
        let args = remove_notifications::Args {
            up_to_notification_index,
        };

        trace!(?args, "remove_notifications::args");

        let request_id = self
            .agent
            .update(&self.canister_id, "remove_notifications")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        let waiter = ThrottleWaiter::new(Duration::from_secs(1));
        self.agent.wait(request_id, &self.canister_id, waiter).await?;
        Ok(())
    }

    pub async fn remove_subscriptions(&self, subscriptions_by_user: HashMap<UserId, Vec<String>>) -> Result<(), Error> {
        if subscriptions_by_user.is_empty() {
            return Ok(());
        }

        let subscriptions_by_user = subscriptions_by_user
            .into_iter()
            .map(|(user_id, p256dh_keys)| remove_subscriptions::UserSubscriptions { user_id, p256dh_keys })
            .collect();

        let args = remove_subscriptions::Args { subscriptions_by_user };

        trace!(?args, "remove_subscriptions::args");

        let request_id = self
            .agent
            .update(&self.canister_id, "remove_subscriptions")
            .with_arg(Encode!(&args)?)
            .call()
            .await?;

        let waiter = ThrottleWaiter::new(Duration::from_secs(1));
        self.agent.wait(request_id, &self.canister_id, waiter).await?;
        Ok(())
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
