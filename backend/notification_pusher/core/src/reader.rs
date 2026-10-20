use crate::bot_notifications::delivery_tracker::DeliveryTracker;
use crate::ic_agent::IcAgent;
use crate::metrics::write_metrics;
use crate::{BotNotification, FcmNotification, NotificationMetadata, PushNotification, UserNotification};
use async_channel::Sender;
use ct_codecs::{Base64NoPadding, Encoder};
use index_store::IndexStore;
use std::cmp::min;
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
    bot_deliveries: Arc<DeliveryTracker>,
}

// How far the reader has got through the notifications canister's notifications. The user and bot
// positions are stored, the read position is only held in memory.
#[derive(Debug, Eq, PartialEq)]
struct Positions {
    read_up_to: u64,
    // User notifications are recorded as processed once queued to be pushed
    user_up_to: u64,
    // Bot notifications are recorded as processed only once delivered or given up on. After a
    // restart those which weren't are read and sent again.
    bot_up_to: u64,
}

impl Positions {
    // Until bot notifications have been tracked separately they're as far along as the users'. The
    // reader goes back to the earlier of the two, to send again what wasn't processed.
    fn new(user_up_to: u64, bot_up_to: Option<u64>) -> Self {
        let bot_up_to = bot_up_to.unwrap_or(user_up_to);
        Positions {
            read_up_to: min(user_up_to, bot_up_to),
            user_up_to,
            bot_up_to,
        }
    }

    // Whether a notification read again after a restart was processed before it
    fn already_processed(&self, index: u64, is_bot: bool) -> bool {
        index <= if is_bot { self.bot_up_to } else { self.user_up_to }
    }

    // Records reading up to `index`, returning the user position to store if it moved
    fn read(&mut self, index: u64) -> Option<u64> {
        self.read_up_to = index;
        (index > self.user_up_to).then(|| {
            self.user_up_to = index;
            index
        })
    }

    // Records the bot notifications being finished up to `index`, returning the bot position to
    // store if it moved
    fn bots_finished(&mut self, index: u64) -> Option<u64> {
        (index > self.bot_up_to).then(|| {
            self.bot_up_to = index;
            index
        })
    }

    // Notifications are kept until both have been processed
    fn prune_up_to(&self) -> u64 {
        min(self.user_up_to, self.bot_up_to)
    }
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
            bot_deliveries: Arc::default(),
        }
    }

    pub async fn run(self) {
        info!(%self.notifications_canister_id, "Notifications reader started");

        let mut interval = time::interval(time::Duration::from_secs(1));

        let mut positions = loop {
            match self.load_positions().await {
                Ok(positions) => break positions,
                Err(error) => {
                    error!(?error, "Load notification indexes failed");
                    interval.tick().await;
                }
            }
        };

        loop {
            if self.user_notification_sender.is_full() {
                error!("Notifications queue is full");
                interval.tick().await;
            } else {
                for _ in 0..30 {
                    if let Err(error) = self.read_notifications(&mut positions).await {
                        error!(?error, "Read notifications failed");
                    }

                    interval.tick().await;
                }

                if let Err(error) = self.prune_notifications(&positions).await {
                    error!(?error, "Prune notifications failed");
                }
            }
        }
    }

    async fn read_notifications(&self, positions: &mut Positions) -> Result<(), Error> {
        let ic_response = self
            .ic_agent
            .notifications(&self.notifications_canister_id, positions.read_up_to + 1)
            .await?;

        let first_read_at = Instant::now();

        let mut latest_index_processed = None;
        for indexed_notification in ic_response.notifications {
            match indexed_notification.value {
                // Pushed before the pusher restarted
                NotificationEnvelope::User(_) if positions.already_processed(indexed_notification.index, false) => {}
                // Delivered or given up on before the pusher restarted
                NotificationEnvelope::Bot(_) if positions.already_processed(indexed_notification.index, true) => {}
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

                    // A call dismissal tells a phone to stop ringing. It has no web push form:
                    // an open web client learns the same facts from chat updates.
                    let fcm_only = notification.fcm_data.as_ref().is_some_and(|d| d.is_call_dismissal());

                    for user_id in notification.recipients {
                        if let Some(subscriptions) = ic_response.subscriptions.get(&user_id) {
                            for subscription in subscriptions.iter().cloned() {
                                if !subscription_wanted(fcm_only, &subscription) {
                                    continue;
                                }
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
                                    _pending_delivery: self.bot_deliveries.start(indexed_notification.index),
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
            if let Some(user_up_to) = positions.read(latest_index) {
                self.index_store.set(&self.user_key(), user_up_to).await?;
            }
        }

        // Updated even when nothing new was read, since deliveries finish in the meantime
        if let Some(bot_up_to) = positions.bots_finished(self.bot_deliveries.finished_up_to(positions.read_up_to)) {
            self.index_store.set(&self.bot_key(), bot_up_to).await?;
        }

        Ok(())
    }

    async fn load_positions(&self) -> Result<Positions, Error> {
        let user_up_to = if let Some(index) = self.index_store.get(&self.user_key()).await? {
            index
        } else {
            let index = self
                .ic_agent
                .latest_notifications_index(&self.notifications_canister_id)
                .await?;

            self.index_store.set(&self.user_key(), index).await?;
            index
        };

        let bot_up_to = self.index_store.get(&self.bot_key()).await?;

        Ok(Positions::new(user_up_to, bot_up_to))
    }

    // Keep the notifications which are yet to be processed, so they can be read again after a restart
    async fn prune_notifications(&self, positions: &Positions) -> Result<(), Error> {
        self.ic_agent
            .remove_notifications(&self.notifications_canister_id, positions.prune_up_to())
            .await
    }

    // The key the user notifications' position has always been stored under
    fn user_key(&self) -> String {
        self.notifications_canister_id.to_string()
    }

    fn bot_key(&self) -> String {
        format!("{}_bots", self.notifications_canister_id)
    }
}

// A call dismissal has no web push form, so it goes only to FCM subscriptions
fn subscription_wanted(fcm_only: bool, subscription: &types::NotificationSubscription) -> bool {
    !fcm_only || !matches!(subscription, types::NotificationSubscription::WebPush(_))
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{FcmToken, NotificationSubscription, SubscriptionInfo, SubscriptionKeys};

    #[test]
    fn first_start_with_bots_tracked_separately_replays_nothing() {
        let positions = Positions::new(100, None);
        assert_eq!(
            positions,
            Positions {
                read_up_to: 100,
                user_up_to: 100,
                bot_up_to: 100
            }
        );
    }

    #[test]
    fn a_restart_replays_only_the_unfinished_bot_notifications() {
        // The pusher stopped while bot notifications after 90 were still being delivered
        let mut positions = Positions::new(100, Some(90));
        assert_eq!(positions.read_up_to, 90);

        // Read again: the user notifications aren't pushed twice, the bot notifications are sent again
        assert!(positions.already_processed(95, false));
        assert!(!positions.already_processed(95, true));
        assert!(positions.already_processed(90, true));

        // Reading up to where the users were doesn't store the user position again
        assert_eq!(positions.read(100), None);
        // Past it, both kinds are new
        assert_eq!(positions.read(105), Some(105));
        assert!(!positions.already_processed(106, false));
        assert!(!positions.already_processed(106, true));
    }

    #[test]
    fn the_bot_position_only_moves_forward() {
        let mut positions = Positions::new(100, Some(90));
        assert_eq!(positions.bots_finished(90), None);
        assert_eq!(positions.bots_finished(95), Some(95));
        assert_eq!(positions.bots_finished(93), None);
        assert_eq!(positions.bot_up_to, 95);
    }

    #[test]
    fn notifications_are_kept_until_both_kinds_are_processed() {
        let mut positions = Positions::new(100, Some(90));
        assert_eq!(positions.prune_up_to(), 90);

        positions.bots_finished(100);
        positions.read(110);
        assert_eq!(positions.prune_up_to(), 100);
    }

    // #9456 invariant 6: a dismissal kind is never sent to a web push subscription
    #[test]
    fn invariant_6_a_dismissal_never_goes_to_a_web_push_subscription() {
        let web = NotificationSubscription::WebPush(SubscriptionInfo {
            endpoint: "e".to_string(),
            keys: SubscriptionKeys {
                p256dh: "p".to_string(),
                auth: "a".to_string(),
            },
        });
        let fcm = NotificationSubscription::FcmPush(FcmToken("t".to_string()));

        assert!(!subscription_wanted(true, &web));
        assert!(subscription_wanted(true, &fcm));
        // an ordinary notification still goes to both
        assert!(subscription_wanted(false, &web));
        assert!(subscription_wanted(false, &fcm));
    }
}
