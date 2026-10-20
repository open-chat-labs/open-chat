use crate::metrics::write_metrics;
use crate::{BotNotification, timestamp};
use async_channel::Receiver;
use reqwest::dns::{Addrs, Name, Resolving};
use reqwest::header::CONTENT_TYPE;
use reqwest::{Client, ClientBuilder, Url};
use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::{Instant, sleep};
use tracing::{info, warn};

// A bot should reply as soon as it has the notification, then process it
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const FIRST_RETRY_DELAY: Duration = Duration::from_secs(1);
const MAX_RETRY_DELAY: Duration = Duration::from_secs(60);
// How long a notification is retried for before it's given up on. Meanwhile the bot's later
// notifications wait, so it gets them in order
const MAX_RETRY_DURATION: Duration = Duration::from_secs(5 * 60);

// Posts a notification to a bot, returning the HTTP status, or an error if there was no response
pub trait BotEndpointClient: Clone + Send + Sync + 'static {
    fn post(
        &self,
        url: Url,
        mime_type: &str,
        signature: &str,
        body: Vec<u8>,
    ) -> impl Future<Output = Result<u16, String>> + Send;
}

#[derive(Clone)]
pub struct HttpClient(Client);

impl HttpClient {
    pub fn new(is_production: bool) -> Self {
        let builder = ClientBuilder::new().timeout(REQUEST_TIMEOUT).connect_timeout(CONNECT_TIMEOUT);

        let builder = if is_production { builder } else { builder.dns_resolver(Arc::new(LocalHostResolver)) };

        HttpClient(builder.build().unwrap())
    }
}

impl BotEndpointClient for HttpClient {
    async fn post(&self, url: Url, mime_type: &str, signature: &str, body: Vec<u8>) -> Result<u16, String> {
        self.0
            .post(url)
            .header(CONTENT_TYPE, mime_type)
            .header("x-oc-signature", signature)
            .body(body)
            .send()
            .await
            .map(|response| response.status().as_u16())
            .map_err(|error| error.to_string())
    }
}

// Pushes the notifications for one bot endpoint, one at a time so the bot gets them in order. Each
// endpoint has its own, so a slow or unreachable bot only holds up its own notifications.
pub struct EndpointPusher<C> {
    receiver: Receiver<BotNotification>,
    client: C,
}

#[derive(Debug, Eq, PartialEq)]
pub enum Outcome {
    Delivered,
    // The bot replied with a status that retrying won't change
    Rejected(u16),
    GaveUp,
    InvalidEndpoint,
}

impl<C: BotEndpointClient> EndpointPusher<C> {
    pub fn new(receiver: Receiver<BotNotification>, client: C) -> Self {
        Self { receiver, client }
    }

    pub async fn run(self) {
        while let Ok(notification) = self.receiver.recv().await {
            let start = std::time::Instant::now();
            let payload_size = notification.payload.data.len() as u64;

            let outcome = deliver(&self.client, &notification).await;

            let success = outcome == Outcome::Delivered;
            let push_duration = start.elapsed().as_millis() as u64;
            let end_to_end_latency = timestamp().saturating_sub(notification.timestamp);
            let end_to_end_internal_latency = notification.first_read_at.elapsed().as_millis() as u64;

            write_metrics(|m| {
                if success {
                    m.observe_notification_payload_size(payload_size, false);
                    m.set_latest_notification_index_pushed(notification.index, notification.notifications_canister);
                } else {
                    m.incr_bot_notifications_dropped(outcome.reason());
                }
                m.observe_end_to_end_latency(end_to_end_latency, false, notification.notifications_canister);
                m.observe_end_to_end_internal_latency(end_to_end_internal_latency, false);
                m.observe_http_post_notification_duration(push_duration, false, success);
            });

            if !success {
                warn!(
                    endpoint = notification.endpoint,
                    index = notification.index,
                    ?outcome,
                    "Bot notification not delivered"
                );
            }
            // Dropping the notification finishes its delivery
        }
    }
}

impl Outcome {
    fn reason(&self) -> &'static str {
        match self {
            Outcome::Delivered => "delivered",
            Outcome::Rejected(_) => "rejected",
            Outcome::GaveUp => "gave_up",
            Outcome::InvalidEndpoint => "invalid_endpoint",
        }
    }
}

pub async fn deliver<C: BotEndpointClient>(client: &C, notification: &BotNotification) -> Outcome {
    let Some(url) = notify_url(&notification.endpoint) else {
        return Outcome::InvalidEndpoint;
    };

    let started = Instant::now();
    let mut retry_delay = FIRST_RETRY_DELAY;

    loop {
        let result = client
            .post(
                url.clone(),
                &notification.mime_type,
                &notification.payload.signature,
                notification.payload.data.to_vec(),
            )
            .await;

        match result {
            Ok(status) if (200..300).contains(&status) => return Outcome::Delivered,
            Ok(status) if !is_retryable(status) => return Outcome::Rejected(status),
            Ok(_) | Err(_) => {}
        }

        if started.elapsed() + retry_delay > MAX_RETRY_DURATION {
            return Outcome::GaveUp;
        }

        info!(
            endpoint = notification.endpoint,
            ?result,
            ?retry_delay,
            "Retrying bot notification"
        );
        write_metrics(|m| m.incr_bot_notification_retries());

        sleep(retry_delay).await;
        retry_delay = (retry_delay * 2).min(MAX_RETRY_DELAY);
    }
}

// Timeouts and errors on the bot's side are worth retrying. Any other refusal is final
fn is_retryable(status: u16) -> bool {
    status >= 500 || status == 408 || status == 429
}

// `{endpoint}/notify`, matching how the website calls a bot's `{endpoint}/execute_command`
fn notify_url(endpoint: &str) -> Option<Url> {
    Url::parse(&format!("{}/notify", endpoint.trim_end_matches('/'))).ok()
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bot_notifications::delivery_tracker::DeliveryTracker;
    use candid::Principal;
    use serde_bytes::ByteBuf;
    use std::collections::VecDeque;
    use std::sync::Mutex;
    use types::BotEventPayload;

    // Replies with each of `responses` in turn, recording the urls posted to
    #[derive(Clone, Default)]
    struct FakeClient {
        responses: Arc<Mutex<VecDeque<Result<u16, String>>>>,
        urls: Arc<Mutex<Vec<String>>>,
    }

    impl FakeClient {
        fn new(responses: Vec<Result<u16, String>>) -> Self {
            crate::metrics::init_for_tests();
            FakeClient {
                responses: Arc::new(Mutex::new(responses.into())),
                urls: Arc::default(),
            }
        }

        fn calls(&self) -> usize {
            self.urls.lock().unwrap().len()
        }
    }

    impl BotEndpointClient for FakeClient {
        async fn post(&self, url: Url, _mime_type: &str, _signature: &str, _body: Vec<u8>) -> Result<u16, String> {
            self.urls.lock().unwrap().push(url.to_string());
            // Once the responses run out, the bot is down
            self.responses.lock().unwrap().pop_front().unwrap_or(Ok(503))
        }
    }

    fn notification(endpoint: &str) -> BotNotification {
        BotNotification {
            notifications_canister: Principal::anonymous(),
            index: 1,
            timestamp: 0,
            endpoint: endpoint.to_string(),
            payload: BotEventPayload {
                data: ByteBuf::from(vec![1, 2, 3]),
                signature: "signature".to_string(),
            },
            mime_type: "application/msgpack".to_string(),
            first_read_at: std::time::Instant::now(),
            _pending_delivery: Arc::new(DeliveryTracker::default()).start(1),
        }
    }

    #[tokio::test(start_paused = true)]
    async fn delivered_at_the_first_attempt() {
        let client = FakeClient::new(vec![Ok(200)]);
        assert_eq!(deliver(&client, &notification("https://bot.xyz")).await, Outcome::Delivered);
        assert_eq!(client.calls(), 1);
    }

    #[tokio::test(start_paused = true)]
    async fn retries_until_the_bot_accepts() {
        let client = FakeClient::new(vec![Ok(503), Err("timed out".to_string()), Ok(429), Ok(408), Ok(204)]);
        assert_eq!(deliver(&client, &notification("https://bot.xyz")).await, Outcome::Delivered);
        assert_eq!(client.calls(), 5);
    }

    #[tokio::test(start_paused = true)]
    async fn a_refusal_isnt_retried() {
        let client = FakeClient::new(vec![Ok(400)]);
        assert_eq!(
            deliver(&client, &notification("https://bot.xyz")).await,
            Outcome::Rejected(400)
        );
        assert_eq!(client.calls(), 1);
    }

    #[tokio::test(start_paused = true)]
    async fn gives_up_after_the_retry_duration() {
        let client = FakeClient::new(vec![]);
        let started = Instant::now();

        assert_eq!(deliver(&client, &notification("https://bot.xyz")).await, Outcome::GaveUp);

        // 1s, 2s, 4s, ... 32s, then 60s at a time, until the next wait would pass 5 minutes
        assert!(started.elapsed() <= MAX_RETRY_DURATION);
        assert_eq!(client.calls(), 10);
    }

    #[tokio::test(start_paused = true)]
    async fn an_invalid_endpoint_isnt_posted_to() {
        let client = FakeClient::new(vec![Ok(200)]);
        assert_eq!(deliver(&client, &notification("not a url")).await, Outcome::InvalidEndpoint);
        assert_eq!(client.calls(), 0);
    }

    #[test]
    fn notify_url_keeps_the_endpoints_path() {
        for (endpoint, expected) in [
            ("https://bot.xyz", "https://bot.xyz/notify"),
            ("https://bot.xyz/", "https://bot.xyz/notify"),
            ("https://bot.xyz/bridge", "https://bot.xyz/bridge/notify"),
            ("https://bot.xyz/bridge/", "https://bot.xyz/bridge/notify"),
        ] {
            assert_eq!(notify_url(endpoint).unwrap().as_str(), expected, "{endpoint}");
        }
    }
}
