use crate::ic_agent::IcAgent;
use crate::metrics::write_metrics;
use crate::{BotNotification, FcmNotification, NotificationMetadata, PushNotification, UserNotification};
use async_channel::Sender;
use ct_codecs::{Base64NoPadding, Decoder, Encoder};
use index_store::IndexStore;
use std::sync::Arc;
use std::time::Instant;
use tokio::time;
use tracing::{error, info};
use types::{BotDataEncoding, CanisterId, Error, NotificationEnvelope, Timestamped};

pub struct Reader<I: IndexStore> {
    ic_agent: IcAgent,
    notifications_canister_id: CanisterId,
    index_store: I,
    user_notification_sender: Sender<PushNotification>,
    bot_notification_sender: Sender<BotNotification>,
}

impl<I: IndexStore> Reader<I> {
    pub fn new(
        ic_agent: IcAgent,
        notifications_canister_id: CanisterId,
        index_store: I,
        user_notification_sender: Sender<PushNotification>,
        bot_notification_sender: Sender<BotNotification>,
    ) -> Self {
        Self {
            ic_agent,
            notifications_canister_id,
            index_store,
            user_notification_sender,
            bot_notification_sender,
        }
    }

    pub async fn run(self) {
        info!(%self.notifications_canister_id, "Notifications reader started");

        let mut interval = time::interval(time::Duration::from_secs(1));
        loop {
            if self.user_notification_sender.is_full() {
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

        let first_read_at = Instant::now();

        let mut latest_index_processed = None;
        for indexed_notification in ic_response.notifications {
            match indexed_notification.value {
                NotificationEnvelope::User(notification) => {
                    let available_capacity = self
                        .user_notification_sender
                        .capacity()
                        .unwrap()
                        .saturating_sub(self.user_notification_sender.len());

                    if available_capacity < notification.recipients.len() {
                        error!(
                            available_capacity,
                            notifications = notification.recipients.len(),
                            "Not enough available capacity to enqueue notifications",
                        );
                        break;
                    }

                    let base64 = Base64NoPadding::encode_to_string(notification.notification_bytes)?;
                    let payload = Arc::new(serde_json::to_vec(&Timestamped::new(base64, notification.timestamp)).unwrap());

                    for user_id in notification.recipients {
                        if let Some(subscriptions) = ic_response.subscriptions.get(&user_id) {
                            for subscription in subscriptions.iter().cloned() {
                                let metadata = NotificationMetadata {
                                    notifications_canister: self.notifications_canister_id,
                                    index: indexed_notification.index,
                                    recipient: user_id,
                                    timestamp: notification.timestamp,
                                    first_read_at,
                                };

                                // Map to push notification based on subscription type
                                let push_notification = match subscription {
                                    types::NotificationSubscription::WebPush(subscription_info) => {
                                        PushNotification::UserNotification(UserNotification {
                                            payload: payload.clone(),
                                            subscription_info,
                                            metadata,
                                        })
                                    }
                                    types::NotificationSubscription::FcmPush(fcm_token) => {
                                        PushNotification::FcmNotification(Box::new(FcmNotification {
                                            fcm_data: notification.fcm_data.clone(),
                                            fcm_token,
                                            metadata,
                                        }))
                                    }
                                };

                                // Wait here if needed to ensure the notification is pushed to all
                                // subscriptions to avoid partially processed notifications
                                self.user_notification_sender.send(push_notification).await.unwrap();
                            }
                        }
                    }
                }
                NotificationEnvelope::Bot(notification) => {
                    for (bot_id, encoding) in notification.recipients {
                        if let Some(endpoint) = ic_response.bot_endpoints.get(&bot_id) {
                            let payload = notification.event_map[&encoding].clone();
                            let mime_type = match encoding {
                                BotDataEncoding::Candid => "application/candid",
                                BotDataEncoding::MsgPack => "application/msgpack",
                                BotDataEncoding::Json => unreachable!("JSON encoding is not supported"),
                            };

                            self.bot_notification_sender
                                .send(BotNotification {
                                    notifications_canister: self.notifications_canister_id,
                                    index: indexed_notification.index,
                                    timestamp: notification.timestamp,
                                    endpoint: endpoint.to_string(),
                                    payload,
                                    mime_type: mime_type.to_string(),
                                    first_read_at,
                                })
                                .await
                                .unwrap();
                        }
                    }
                }
            }

            latest_index_processed = Some(indexed_notification.index);
        }

        if let Some(latest_index) = latest_index_processed {
            write_metrics(|m| m.set_latest_notification_index_read(latest_index, self.notifications_canister_id));
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
