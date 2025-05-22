use crate::metrics::write_metrics;
use crate::{BotNotification, timestamp};
use async_channel::Receiver;
use reqwest::dns::{Addrs, Name, Resolving};
use reqwest::{Client, ClientBuilder, Url};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Instant;

pub struct Pusher {
    receiver: Receiver<BotNotification>,
    http_client: Client,
}

impl Pusher {
    pub fn new(receiver: Receiver<BotNotification>) -> Self {
        let custom_resolver = Arc::new(LocalHostResolver);

        Self {
            receiver,
            http_client: ClientBuilder::new().dns_resolver(custom_resolver).build().unwrap(),
        }
    }

    pub async fn run(self) {
        while let Ok(notification) = self.receiver.recv().await {
            let start = Instant::now();
            let payload_size = notification.payload.len() as u64;
            let push_result = self.push_notification(notification.payload, notification.endpoint).await;

            let success = push_result.is_ok();
            let end = Instant::now();
            let push_duration = end.saturating_duration_since(start).as_millis() as u64;
            let timestamp = timestamp();
            let end_to_end_latency = timestamp.saturating_sub(notification.timestamp);
            let end_to_end_internal_latency = end.saturating_duration_since(notification.first_read_at).as_millis() as u64;

            write_metrics(|m| {
                if success {
                    m.observe_notification_payload_size(payload_size, false);
                    m.set_latest_notification_index_pushed(notification.index, notification.notifications_canister);
                }
                m.observe_end_to_end_latency(end_to_end_latency, false, notification.notifications_canister);
                m.observe_end_to_end_internal_latency(end_to_end_internal_latency, false);
                m.observe_http_post_notification_duration(push_duration, false, success);
            });
        }
    }

    async fn push_notification(&self, payload: Vec<u8>, endpoint: String) -> Result<(), String> {
        let mut url = Url::parse(&endpoint).map_err(|e| e.to_string())?;
        url = url.join("notify").map_err(|e| e.to_string())?;
        self.http_client.post(url).body(payload).send().await.unwrap();
        Ok(())
    }
}

struct LocalHostResolver;

impl reqwest::dns::Resolve for LocalHostResolver {
    fn resolve(&self, name: Name) -> Resolving {
        if name.as_str().contains("localhost") {
            // If the domain name contains "localhost" resolve it to std localhost
            let socket = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 0);
            let addrs: Addrs = Box::new(std::iter::once(socket));
            Box::pin(async move { Ok(addrs) })
        } else {
            // Fallback to system DNS resolution
            let domain_name = name.as_str().to_owned();
            Box::pin(async move {
                let addrs: Addrs = Box::new(tokio::net::lookup_host((domain_name, 0)).await?);
                Ok(addrs)
            })
        }
    }
}
