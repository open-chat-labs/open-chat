use crate::BotNotification;
use crate::bot_notifications::pusher::{BotEndpointClient, EndpointPusher, HttpClient};
use crate::metrics::write_metrics;
use async_channel::{Receiver, Sender, TrySendError};
use std::collections::HashMap;
use tracing::warn;

pub mod delivery_tracker;
mod pusher;

// How many notifications a bot can fall behind by, eg. while it's down and its notification at
// the front is retried, before its newer ones are dropped
const ENDPOINT_QUEUE_CAPACITY: usize = 10_000;

pub fn start_bot_notifications_processor(is_production: bool) -> Sender<BotNotification> {
    let (sender, receiver) = async_channel::bounded::<BotNotification>(200_000);

    tokio::spawn(dispatch(receiver, HttpClient::new(is_production)));

    sender
}

// Passes each notification on to its bot endpoint's own queue and pusher, so one slow or
// unreachable bot can't hold up the notifications of the others
async fn dispatch<C: BotEndpointClient>(receiver: Receiver<BotNotification>, client: C) {
    let mut endpoint_queues: HashMap<String, Sender<BotNotification>> = HashMap::new();

    while let Ok(notification) = receiver.recv().await {
        let queue = endpoint_queues.entry(notification.endpoint.clone()).or_insert_with(|| {
            let (sender, receiver) = async_channel::bounded(ENDPOINT_QUEUE_CAPACITY);
            tokio::spawn(EndpointPusher::new(receiver, client.clone()).run());
            sender
        });

        // Dropping a notification finishes its delivery
        match queue.try_send(notification) {
            Ok(()) => {}
            Err(TrySendError::Full(notification)) => {
                warn!(
                    endpoint = notification.endpoint,
                    index = notification.index,
                    "Bot notification dropped, the bot's queue is full"
                );
                write_metrics(|m| m.incr_bot_notifications_dropped("queue_full"));
            }
            Err(TrySendError::Closed(notification)) => {
                // The endpoint's pusher has stopped. Dropping its queue finishes the notifications in
                // it, and the next notification for the endpoint starts a new pusher.
                warn!(
                    endpoint = notification.endpoint,
                    index = notification.index,
                    "Bot notification dropped, the bot's pusher stopped"
                );
                endpoint_queues.remove(&notification.endpoint);
                write_metrics(|m| m.incr_bot_notifications_dropped("pusher_stopped"));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bot_notifications::delivery_tracker::{DeliveryTracker, PendingDelivery};
    use candid::Principal;
    use reqwest::Url;
    use serde_bytes::ByteBuf;
    use std::sync::{Arc, Mutex};
    use types::BotEventPayload;

    // Never replies to stuck.xyz, and accepts everything else
    #[derive(Clone, Default)]
    struct StuckClient {
        delivered: Arc<Mutex<Vec<String>>>,
    }

    impl BotEndpointClient for StuckClient {
        async fn post(&self, url: Url, _mime_type: &str, _signature: &str, _body: Vec<u8>) -> Result<u16, String> {
            if url.as_str().starts_with("https://stuck.xyz") {
                std::future::pending::<()>().await;
            }
            self.delivered.lock().unwrap().push(url.to_string());
            Ok(200)
        }
    }

    fn notification(endpoint: &str, index: u64, pending_delivery: PendingDelivery) -> BotNotification {
        BotNotification {
            notifications_canister: Principal::anonymous(),
            index,
            timestamp: 0,
            endpoint: endpoint.to_string(),
            payload: BotEventPayload {
                data: ByteBuf::from(vec![1, 2, 3]),
                signature: "signature".to_string(),
            },
            mime_type: "application/msgpack".to_string(),
            first_read_at: std::time::Instant::now(),
            _pending_delivery: pending_delivery,
        }
    }

    #[tokio::test(start_paused = true)]
    async fn a_stuck_bot_doesnt_hold_up_the_others() {
        crate::metrics::init_for_tests();
        let client = StuckClient::default();
        let tracker = Arc::new(DeliveryTracker::default());
        let (sender, receiver) = async_channel::bounded(10);
        tokio::spawn(dispatch(receiver, client.clone()));

        sender
            .send(notification("https://stuck.xyz", 1, tracker.start(1)))
            .await
            .unwrap();
        sender
            .send(notification("https://fast.xyz", 2, tracker.start(2)))
            .await
            .unwrap();
        for _ in 0..10 {
            tokio::task::yield_now().await;
        }

        assert_eq!(*client.delivered.lock().unwrap(), vec!["https://fast.xyz/notify".to_string()]);
        // The stuck bot's notification is still being delivered, so it isn't finished
        assert_eq!(tracker.finished_up_to(2), 0);
    }
}
