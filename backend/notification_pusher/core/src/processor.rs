use crate::metrics::write_metrics;
use crate::{timestamp, Notification, NotificationToPush};
use async_channel::{Receiver, Sender};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Instant;
use tracing::info;
use types::TimestampMillis;
use web_push::{
    ContentEncoding, PartialVapidSignatureBuilder, SubscriptionInfo, Urgency, VapidSignature, VapidSignatureBuilder,
    WebPushError, WebPushMessage, WebPushMessageBuilder,
};

const MAX_PAYLOAD_LENGTH_BYTES: u32 = 3 * 1000; // Just under 3KB

pub struct Processor {
    receiver: Receiver<Notification>,
    sender: Sender<NotificationToPush>,
    sig_builder: PartialVapidSignatureBuilder,
    invalid_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
    throttled_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
}

impl Processor {
    pub fn new(
        receiver: Receiver<Notification>,
        sender: Sender<NotificationToPush>,
        vapid_private_pem: &str,
        invalid_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
        throttled_subscriptions: Arc<RwLock<HashMap<String, TimestampMillis>>>,
    ) -> Self {
        Self {
            receiver,
            sender,
            sig_builder: VapidSignatureBuilder::from_pem_no_sub(vapid_private_pem.as_bytes()).unwrap(),
            invalid_subscriptions,
            throttled_subscriptions,
        }
    }

    pub async fn run(self) {
        while let Ok(notification) = self.receiver.recv().await {
            let start = Instant::now();
            let notifications_canister = notification.notifications_canister;
            let index = notification.index;

            let result = self.process_notification(&notification);
            let success = result.is_ok();
            if let Ok(message) = result {
                self.sender.send(NotificationToPush { notification, message }).await.unwrap();
            }
            let end = Instant::now();
            let duration = end.saturating_duration_since(start).as_millis() as u64;
            write_metrics(|m| {
                m.observe_processing_duration(duration, success);
                m.set_latest_notification_index_processed(index, notifications_canister);
            });
        }
    }

    fn process_notification(&self, notification: &Notification) -> Result<WebPushMessage, ProcessNotificationError> {
        if let Ok(map) = self.invalid_subscriptions.read() {
            if map.contains_key(&notification.subscription_info.endpoint) {
                return Err(ProcessNotificationError::SubscriptionInvalid);
            }
        }
        if let Ok(map) = self.throttled_subscriptions.read() {
            if let Some(until) = map.get(&notification.subscription_info.endpoint) {
                let timestamp = timestamp();
                if *until > timestamp {
                    info!("Notification skipped due to subscription being throttled");
                    return Err(ProcessNotificationError::SubscriptionThrottled);
                }
            }
        }
        let payload_bytes = notification.payload.as_ref();
        let subscription = &notification.subscription_info;
        let vapid_signature = self
            .build_vapid_signature(subscription)
            .map_err(ProcessNotificationError::FailedToBuildSignature)?;

        let message = build_web_push_message(payload_bytes, subscription, vapid_signature.clone())
            .map_err(ProcessNotificationError::FailedToBuildMessage)?;

        let length = message.payload.as_ref().map_or(0, |p| p.content.len()) as u32;
        if length <= MAX_PAYLOAD_LENGTH_BYTES {
            Ok(message)
        } else {
            Err(ProcessNotificationError::PayloadTooLarge(length))
        }
    }

    fn build_vapid_signature(&self, subscription: &SubscriptionInfo) -> Result<VapidSignature, WebPushError> {
        let mut sig_builder = self.sig_builder.clone().add_sub_info(subscription);
        sig_builder.add_claim("sub", "https://oc.app");
        sig_builder.build()
    }
}

#[allow(dead_code)]
enum ProcessNotificationError {
    SubscriptionInvalid,
    SubscriptionThrottled,
    PayloadTooLarge(u32),
    FailedToBuildSignature(WebPushError),
    FailedToBuildMessage(WebPushError),
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
