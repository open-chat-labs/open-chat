use crate::Notification;
use async_channel::{Receiver, Sender};
use tracing::{error, info};
use types::{Error, UserId};
use web_push::{
    ContentEncoding, PartialVapidSignatureBuilder, SubscriptionInfo, Urgency, VapidSignature, VapidSignatureBuilder,
    WebPushClient, WebPushError, WebPushMessage, WebPushMessageBuilder,
};

// Max notification size (including everything) is as low as 3 KB for some browsers, so we restrict
// the payload to 2 KB to ensure we don't exceed 3 KB once everything else is included.
const MAX_PAYLOAD_LENGTH_BYTES: usize = 2 * 1024;

pub struct Pusher {
    receiver: Receiver<Notification>,
    web_push_client: WebPushClient,
    sig_builder: PartialVapidSignatureBuilder,
    subscriptions_to_remove_sender: Sender<(UserId, String)>,
}

impl Pusher {
    pub fn new(
        receiver: Receiver<Notification>,
        vapid_private_pem: &str,
        subscriptions_to_remove_sender: Sender<(UserId, String)>,
    ) -> Self {
        Self {
            receiver,
            web_push_client: WebPushClient::new().unwrap(),
            sig_builder: VapidSignatureBuilder::from_pem_no_sub(vapid_private_pem.as_bytes()).unwrap(),
            subscriptions_to_remove_sender,
        }
    }

    pub async fn run(self) {
        while let Ok(notification) = self.receiver.recv().await {
            if let Err(error) = self.push_notification(&notification).await {
                let bytes = notification.payload.len();
                error!(
                    ?error,
                    bytes, notification.subscription_info.endpoint, "Failed to push notification"
                );
            }
        }
    }

    pub async fn push_notification(&self, notification: &Notification) -> Result<(), Error> {
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

                        info!(
                            ?error,
                            subscription.endpoint, "Failed to push notification, subscription queued to be removed"
                        );
                        Ok(())
                    }
                    _ => Err(error.into()),
                }
            } else {
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
    let mut message_builder = WebPushMessageBuilder::new(subscription)?;
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
