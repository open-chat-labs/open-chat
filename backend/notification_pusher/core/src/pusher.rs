use crate::metrics::write_metrics;
use crate::{timestamp, NotificationToPush};
use async_channel::{Receiver, Sender};
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
}

impl Pusher {
    pub fn new(
        receiver: Receiver<NotificationToPush>,
        subscriptions_to_remove_sender: Sender<(UserId, String)>,
        invalid_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
        throttled_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
    ) -> Self {
        Self {
            receiver,
            web_push_client: HyperWebPushClient::new(),
            subscriptions_to_remove_sender,
            invalid_subscriptions,
            throttled_subscriptions,
        }
    }

    pub async fn run(self) {
        while let Ok(NotificationToPush { notification, message }) = self.receiver.recv().await {
            let payload_bytes = message.payload.as_ref().map_or(0, |p| p.content.len()) as u64;
            let start = Instant::now();
            let push_result = self.web_push_client.send(message).await;
            let success = push_result.is_ok();

            if let Err(error) = push_result {
                match error {
                    WebPushError::EndpointNotValid | WebPushError::InvalidUri | WebPushError::EndpointNotFound => {
                        let _ = self
                            .subscriptions_to_remove_sender
                            .try_send((notification.recipient, notification.subscription_info.keys.p256dh.clone()));
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

            let end = Instant::now();
            let push_duration = end.saturating_duration_since(start).as_millis() as u64;
            let timestamp = timestamp();
            let end_to_end_latency = timestamp.saturating_sub(notification.timestamp);
            let end_to_end_internal_latency = end.saturating_duration_since(notification.first_read_at).as_millis() as u64;
            write_metrics(|m| {
                if success {
                    m.incr_total_notifications_pushed();
                    m.incr_total_notification_bytes_pushed(payload_bytes);
                    m.set_latest_notification_index_pushed(notification.index, notification.notifications_canister);
                }
                m.observe_end_to_end_latency(end_to_end_latency, notification.notifications_canister);
                m.observe_end_to_end_internal_latency(end_to_end_internal_latency);
                m.observe_send_web_push_message_duration(push_duration, success);
            });
        }
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
