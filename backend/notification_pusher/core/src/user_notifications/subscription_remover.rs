use crate::ic_agent::IcAgent;
use async_channel::Receiver;
use std::collections::HashMap;
use tokio::time;
use tracing::{error, info};
use types::{CanisterId, PushIfNotContains, UserId};

pub struct SubscriptionRemover {
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    subscriptions_to_remove_receiver: Receiver<(UserId, (String, String))>,
}

impl SubscriptionRemover {
    pub fn new(
        ic_agent: IcAgent,
        index_canister_id: CanisterId,
        subscriptions_to_remove_receiver: Receiver<(UserId, (String, String))>,
    ) -> Self {
        Self {
            ic_agent,
            index_canister_id,
            subscriptions_to_remove_receiver,
        }
    }

    pub async fn run(self) {
        let mut interval = time::interval(time::Duration::from_secs(60));
        loop {
            let mut subscriptions_to_remove: HashMap<UserId, (Vec<String>, Vec<String>)> = HashMap::new();
            while let Ok((user_id, (endpoint, p256dh))) = self.subscriptions_to_remove_receiver.try_recv() {
                let (endpoints, p256dh_keys) = subscriptions_to_remove.entry(user_id).or_default();

                endpoints.push_if_not_contains(endpoint);
                p256dh_keys.push_if_not_contains(p256dh);
            }

            if !subscriptions_to_remove.is_empty() {
                let count = subscriptions_to_remove.len();
                if let Err(error) = self
                    .ic_agent
                    .remove_subscriptions(&self.index_canister_id, subscriptions_to_remove)
                    .await
                {
                    error!(?error, "Failed to remove subscriptions");
                } else {
                    info!("Removed {count} subscriptions");
                }
            }

            interval.tick().await;
        }
    }
}
