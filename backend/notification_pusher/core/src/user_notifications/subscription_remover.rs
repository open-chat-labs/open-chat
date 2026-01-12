use crate::ic_agent::IcAgent;
use async_channel::Receiver;
use std::collections::HashMap;
use tokio::time;
use tracing::{error, info};
use types::{CanisterId, PushIfNotContains, UserId};

pub struct SubscriptionRemover {
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    subscriptions_to_remove_receiver: Receiver<(UserId, String)>,
}

impl SubscriptionRemover {
    pub fn new(
        ic_agent: IcAgent,
        index_canister_id: CanisterId,
        subscriptions_to_remove_receiver: Receiver<(UserId, String)>,
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
            let mut subscriptions_to_remove: HashMap<UserId, Vec<String>> = HashMap::new();
            while let Ok((user_id, endpoint)) = self.subscriptions_to_remove_receiver.try_recv() {
                subscriptions_to_remove
                    .entry(user_id)
                    .or_default()
                    .push_if_not_contains(endpoint);
            }

            if !subscriptions_to_remove.is_empty() {
                let count = subscriptions_to_remove.len();
                let user_ids: Vec<_> = subscriptions_to_remove.keys().map(|u| u.to_string()).collect();
                if let Err(error) = self
                    .ic_agent
                    .remove_subscriptions(&self.index_canister_id, subscriptions_to_remove)
                    .await
                {
                    error!(?error, "Failed to remove subscriptions");
                } else {
                    info!(?user_ids, "Removed {count} subscriptions");
                }
            }

            interval.tick().await;
        }
    }
}
