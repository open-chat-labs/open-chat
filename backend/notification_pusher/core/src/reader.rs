use crate::ic_agent::IcAgent;
use crate::Notification;
use async_channel::Sender;
use base64::Engine;
use index_store::IndexStore;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time;
use tracing::{error, info};
use types::{CanisterId, Error, Timestamped, UserId};
use web_push::{SubscriptionInfo, SubscriptionKeys};

pub struct Reader<I: IndexStore> {
    ic_agent: IcAgent,
    notifications_canister_id: CanisterId,
    index_store: I,
    sender: Sender<Notification>,
}

impl<I: IndexStore> Reader<I> {
    pub fn new(ic_agent: IcAgent, notifications_canister_id: CanisterId, index_store: I, sender: Sender<Notification>) -> Self {
        Self {
            ic_agent,
            notifications_canister_id,
            index_store,
            sender,
        }
    }

    pub async fn run(self) {
        info!(%self.notifications_canister_id, "Notifications reader started");

        let mut interval = time::interval(time::Duration::from_secs(1));
        loop {
            if self.sender.is_full() {
                error!("Notifications queue is full");
                interval.tick().await;
            } else {
                for _ in 0..30 {
                    if let Err(error) = self.read_notifications().await {
                        error!(?error, "Read notifications failed");
                    }

                    interval.tick().await;
                }

                if let Err(error) = self.prune_notifications().await {
                    error!(?error, "Prune notifications failed");
                }
            }
        }
    }

    async fn read_notifications(&self) -> Result<(), Error> {
        let from_notification_index = self.index_processed_up_to().await? + 1;
        let ic_response = self
            .ic_agent
            .notifications(&self.notifications_canister_id, from_notification_index)
            .await?;

        let subscriptions_map: HashMap<UserId, Vec<SubscriptionInfo>> = ic_response
            .subscriptions
            .into_iter()
            .map(|(k, v)| (k, v.into_iter().map(convert_subscription).collect()))
            .collect();

        let mut latest_index_processed = None;
        for indexed_notification in ic_response.notifications.into_iter() {
            let notification = indexed_notification.value;
            let available_capacity = self.sender.capacity().unwrap().saturating_sub(self.sender.len());
            if available_capacity < notification.recipients.len() {
                error!(
                    available_capacity,
                    notifications = notification.recipients.len(),
                    "Not enough available capacity to enqueue notifications",
                );
                break;
            }

            let base64 = base64::engine::general_purpose::STANDARD_NO_PAD.encode(notification.notification_bytes);
            let payload = Arc::new(serde_json::to_vec(&Timestamped::new(base64, notification.timestamp)).unwrap());

            for user_id in notification.recipients {
                if let Some(subscriptions) = subscriptions_map.get(&user_id) {
                    for subscription_info in subscriptions.iter().cloned() {
                        self.sender
                            .try_send(Notification {
                                recipient: user_id,
                                payload: payload.clone(),
                                subscription_info,
                            })
                            .unwrap();
                    }
                }
            }

            latest_index_processed = Some(indexed_notification.index);
        }

        if let Some(latest_index) = latest_index_processed {
            self.set_index_processed_up_to(latest_index).await?;
        }

        Ok(())
    }

    async fn index_processed_up_to(&self) -> Result<u64, Error> {
        if let Some(index) = self.index_store.get(self.notifications_canister_id).await? {
            Ok(index)
        } else {
            let index = self
                .ic_agent
                .latest_notifications_index(&self.notifications_canister_id)
                .await?;

            self.set_index_processed_up_to(index).await?;

            Ok(index)
        }
    }

    async fn set_index_processed_up_to(&self, index: u64) -> Result<(), Error> {
        self.index_store.set(self.notifications_canister_id, index).await
    }

    async fn prune_notifications(&self) -> Result<(), Error> {
        let maybe_notification_index_processed_up_to = self.index_store.get(self.notifications_canister_id).await?;

        if let Some(notification_index_processed_up_to) = maybe_notification_index_processed_up_to {
            self.ic_agent
                .remove_notifications(&self.notifications_canister_id, notification_index_processed_up_to)
                .await?;
        }

        Ok(())
    }
}

fn convert_subscription(value: types::SubscriptionInfo) -> SubscriptionInfo {
    SubscriptionInfo {
        endpoint: value.endpoint,
        keys: SubscriptionKeys {
            p256dh: value.keys.p256dh,
            auth: value.keys.auth,
        },
    }
}
