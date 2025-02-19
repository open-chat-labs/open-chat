use crate::metrics::METRICS;
use crate::Notification;
use async_channel::{Receiver, Sender};
use std::collections::{BinaryHeap, HashMap};
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{error, info};
use types::{Error, Milliseconds, TimestampMillis, UserId};
use web_push::{
    ContentEncoding, HyperWebPushClient, PartialVapidSignatureBuilder, SubscriptionInfo, Urgency, VapidSignature,
    VapidSignatureBuilder, WebPushClient, WebPushError, WebPushMessage, WebPushMessageBuilder,
};

const MAX_PAYLOAD_LENGTH_BYTES: usize = 3 * 1000; // Just under 3KB
const ONE_MINUTE: Milliseconds = 60 * 1000;

pub struct Pusher {
    receiver: Receiver<Notification>,
    web_push_client: HyperWebPushClient,
    sig_builder: PartialVapidSignatureBuilder,
    subscriptions_to_remove_sender: Sender<(UserId, String)>,
    invalid_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
    throttled_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
}

impl Pusher {
    pub fn new(
        receiver: Receiver<Notification>,
        vapid_private_pem: &str,
        subscriptions_to_remove_sender: Sender<(UserId, String)>,
        invalid_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
        throttled_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
    ) -> Self {
        Self {
            receiver,
            web_push_client: HyperWebPushClient::new(),
            sig_builder: VapidSignatureBuilder::from_pem_no_sub(vapid_private_pem.as_bytes()).unwrap(),
            subscriptions_to_remove_sender,
            invalid_subscriptions,
            throttled_subscriptions,
        }
    }

    pub async fn run(self) {
        while let Ok(notification) = self.receiver.recv().await {
            self.process_notification(&notification).await;

            let latency_ms = timestamp().saturating_sub(notification.timestamp);
            METRICS.set_latest_notification_index_processed(notification.index, notification.notifications_canister);
            METRICS.set_notification_latency_ms(latency_ms, notification.notifications_canister);
        }
    }

    async fn process_notification(&self, notification: &Notification) {
        if let Ok(map) = self.invalid_subscriptions.read() {
            if map.contains_key(&notification.subscription_info.endpoint) {
                return;
            }
        }
        if let Ok(map) = self.throttled_subscriptions.read() {
            if let Some(until) = map.get(&notification.subscription_info.endpoint) {
                let timestamp = timestamp();
                if *until > timestamp {
                    info!("Notification skipped due to subscription being throttled");
                    return;
                }
            }
        }
        if let Err(error) = self.push_notification(notification).await {
            let bytes = notification.payload.len();
            error!(
                ?error,
                bytes, notification.subscription_info.endpoint, "Failed to push notification"
            );
        } else {
            METRICS.incr_user_notifications_pushed();
        }
    }

    async fn push_notification(&self, notification: &Notification) -> Result<(), Error> {
        let payload_bytes = notification.payload.as_ref();
        let subscription = &notification.subscription_info;
        let vapid_signature = self.build_vapid_signature(subscription)?;

        let message = build_web_push_message(payload_bytes, subscription, vapid_signature.clone())?;
        let length = message.payload.as_ref().map_or(0, |p| p.content.len());
        if length <= MAX_PAYLOAD_LENGTH_BYTES {
            if let Err(error) = self.web_push_client.send(message).await {
                match error {
                    WebPushError::EndpointNotValid | WebPushError::InvalidUri | WebPushError::EndpointNotFound => {
                        let _ = self
                            .subscriptions_to_remove_sender
                            .try_send((notification.recipient, subscription.keys.p256dh.clone()));

                        if let Ok(mut map) = self.invalid_subscriptions.write() {
                            if map.len() > 10000 {
                                prune_invalid_subscriptions(&mut map);
                            }
                            map.insert(subscription.endpoint.clone(), timestamp());
                        }

                        info!(
                            ?error,
                            subscription.endpoint, "Failed to push notification, subscription queued to be removed"
                        );
                        Ok(())
                    }
                    _ => {
                        if let Ok(mut map) = self.throttled_subscriptions.write() {
                            if map.len() > 100 {
                                let timestamp = timestamp();
                                map.retain(|_, ts| *ts > timestamp);
                            }
                            info!(subscription.endpoint, "Subscription throttled for 1 minute");
                            map.insert(subscription.endpoint.clone(), timestamp() + ONE_MINUTE);
                        }
                        Err(error.into())
                    }
                }
            } else {
                METRICS.incr_total_notifications_pushed();
                METRICS.incr_total_notification_bytes_pushed(length as u64);
                Ok(())
            }
        } else {
            Err(format!("Max length exceeded. Length: {length}").into())
        }
    }

    fn build_vapid_signature(&self, subscription: &SubscriptionInfo) -> Result<VapidSignature, WebPushError> {
        let mut sig_builder = self.sig_builder.clone().add_sub_info(subscription);
        sig_builder.add_claim("sub", "https://oc.app");
        sig_builder.build()
    }
}

fn build_web_push_message(
    payload: &[u8],
    subscription: &SubscriptionInfo,
    vapid_signature: VapidSignature,
) -> Result<WebPushMessage, WebPushError> {
    let mut message_builder = WebPushMessageBuilder::new(subscription);
    message_builder.set_payload(ContentEncoding::Aes128Gcm, payload);
    message_builder.set_vapid_signature(vapid_signature);
    message_builder.set_ttl(3600); // 1 hour
    message_builder.set_urgency(Urgency::High);
    message_builder.build()
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

fn timestamp() -> TimestampMillis {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}

#[derive(Debug)]
#[allow(dead_code)]
struct SubscriptionInfoDebug<'a> {
    endpoint: &'a str,
    p256dh_len: usize,
    auth_len: usize,
}

impl<'a> From<&'a SubscriptionInfo> for SubscriptionInfoDebug<'a> {
    fn from(s: &'a SubscriptionInfo) -> Self {
        SubscriptionInfoDebug {
            endpoint: &s.endpoint,
            p256dh_len: s.keys.p256dh.len(),
            auth_len: s.keys.auth.len(),
        }
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
