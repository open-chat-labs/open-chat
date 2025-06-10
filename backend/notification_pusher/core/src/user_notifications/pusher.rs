use crate::metrics::write_metrics;
use crate::{FcmNotification, NotificationToPush, UserNotificationToPush, timestamp};
use async_channel::{Receiver, Sender};
use fcm_service::{FcmMessage, FcmNotification as ExternalFcmNotification, FcmService, Target};
use std::collections::{BinaryHeap, HashMap};
use std::sync::{Arc, RwLock};
use std::time::Instant;
use tracing::info;
use types::{Milliseconds, TimestampMillis, UserId};
use web_push::{HyperWebPushClient, WebPushClient, WebPushError};

const ONE_MINUTE: Milliseconds = 60 * 1000;

pub struct Pusher {
    receiver: Receiver<NotificationToPush>,
    web_push_client: HyperWebPushClient,
    subscriptions_to_remove_sender: Sender<(UserId, String)>,
    invalid_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
    throttled_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
    fcm_service: FcmService,
}

impl Pusher {
    pub fn new(
        receiver: Receiver<NotificationToPush>,
        subscriptions_to_remove_sender: Sender<(UserId, String)>,
        invalid_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
        throttled_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
        gcloud_sa_json_path: String,
    ) -> Self {
        Self {
            receiver,
            web_push_client: HyperWebPushClient::new(),
            subscriptions_to_remove_sender,
            invalid_subscriptions,
            throttled_subscriptions,
            fcm_service: FcmService::new(gcloud_sa_json_path),
        }
    }

    pub async fn run(self) {
        while let Ok(notification_to_push) = self.receiver.recv().await {
            let start = Instant::now();

            let (metadata, payload_size, success) = match notification_to_push {
                NotificationToPush::UserNotificationToPush(user_notification_to_push) => {
                    let metadata = user_notification_to_push.notification.metadata.clone();
                    let payload_size = user_notification_to_push
                        .message
                        .payload
                        .as_ref()
                        .map_or(0, |p| p.content.len()) as u64;

                    // Push the notification to the user
                    let success = self.process_user_notification_to_push(user_notification_to_push).await;

                    (metadata, Some(payload_size), success)
                }
                NotificationToPush::FcmNotificationToPush(fcm_notification_to_push) => {
                    let metadata = fcm_notification_to_push.metadata.clone();
                    let success = self.process_fcm_notification_to_push(fcm_notification_to_push).await;

                    // TODO check result here, and raise event to remove token
                    // if send notification failed!

                    (metadata, None, success)
                }
            };

            let end = Instant::now();
            let push_duration = end.saturating_duration_since(start).as_millis() as u64;
            let timestamp = timestamp();
            let end_to_end_latency = timestamp.saturating_sub(metadata.timestamp);
            let end_to_end_internal_latency = end.saturating_duration_since(metadata.first_read_at).as_millis() as u64;

            write_metrics(|m| {
                if success {
                    if let Some(size) = payload_size {
                        m.observe_notification_payload_size(size, true);
                    }
                    m.set_latest_notification_index_pushed(metadata.index, metadata.notifications_canister);
                }
                m.observe_end_to_end_latency(end_to_end_latency, true, metadata.notifications_canister);
                m.observe_end_to_end_internal_latency(end_to_end_internal_latency, true);
                m.observe_http_post_notification_duration(push_duration, true, success);
            });
        }
    }

    async fn process_user_notification_to_push(&self, user_notification_to_push: UserNotificationToPush) -> bool {
        let UserNotificationToPush { notification, message } = user_notification_to_push;
        let push_result = self.web_push_client.send(message).await;
        let success = push_result.is_ok();

        if let Err(error) = push_result {
            match error {
                WebPushError::EndpointNotValid | WebPushError::InvalidUri | WebPushError::EndpointNotFound => {
                    let _ = self.subscriptions_to_remove_sender.try_send((
                        notification.metadata.recipient,
                        notification.subscription_info.keys.p256dh.clone(),
                    ));
                    if let Ok(mut map) = self.invalid_subscriptions.write() {
                        if map.len() > 10000 {
                            prune_invalid_subscriptions(&mut map);
                        }
                        map.insert(notification.subscription_info.endpoint.clone(), timestamp());
                    }

                    info!(
                        ?error,
                        notification.subscription_info.endpoint,
                        "Failed to push notification, subscription queued to be removed"
                    );
                }
                _ => {
                    if let Ok(mut map) = self.throttled_subscriptions.write() {
                        let timestamp = timestamp();
                        if map.len() > 100 {
                            map.retain(|_, ts| *ts > timestamp);
                        }
                        info!(notification.subscription_info.endpoint, "Subscription throttled for 1 minute");
                        map.insert(notification.subscription_info.endpoint.clone(), timestamp + ONE_MINUTE);
                    }
                }
            }
        }

        success
    }

    async fn process_fcm_notification_to_push(&self, fcm_notification_to_push: Box<FcmNotification>) -> bool {
        let fcm_data = fcm_notification_to_push.fcm_data;
        let mut message = FcmMessage::new();
        let mut notification = ExternalFcmNotification::new();

        let mut android_notification = fcm_service::AndroidNotification::new();
        // We can route messages to different channels, which can have different setups
        android_notification.set_channel_id(Some("oc_messages".into()));
        // TODO add url for the sender avatar, then we can do:
        // android_notification.set_icon(fcm_data.sender_icon)

        let mut android_cfg = fcm_service::AndroidConfig::new();
        android_cfg.set_notification(Some(android_notification));

        notification.set_title(fcm_data.title);
        notification.set_body(fcm_data.body);
        notification.set_image(fcm_data.image);
        // TODO add any additional data to the notification

        message.set_notification(Some(notification));
        message.set_target(Target::Token(fcm_notification_to_push.fcm_token.0));
        message.set_android(Some(android_cfg));

        self.fcm_service.send_notification(message).await.is_ok()
    }
}

// Prunes the oldest 1000 subscriptions
fn prune_invalid_subscriptions(map: &mut HashMap<String, TimestampMillis>) {
    let mut heap = BinaryHeap::with_capacity(1000);

    let mut iter = map.iter();
    for (subscription, timestamp) in iter.by_ref().take(1000) {
        heap.push((*timestamp, subscription.clone()));
    }

    for (subscription, timestamp) in iter {
        if let Some((greatest_timestamp, _)) = heap.peek() {
            if *timestamp < *greatest_timestamp {
                heap.pop();
                heap.push((*timestamp, subscription.clone()));
            }
        }
    }

    for (_, subscription) in heap {
        map.remove(&subscription);
    }
}

#[test]
fn oldest_subscriptions_are_pruned() {
    let mut map = HashMap::new();
    for i in 0..10000 {
        map.insert(i.to_string(), i);
    }

    prune_invalid_subscriptions(&mut map);

    assert_eq!(map.len(), 9000);

    for i in 0..10000 {
        assert_eq!(map.contains_key(i.to_string().as_str()), i >= 1000, "{i}");
    }
}
