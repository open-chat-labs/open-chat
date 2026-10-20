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

        if let Err(TrySendError::Full(notification) | TrySendError::Closed(notification)) = queue.try_send(notification) {
            // Dropping it finishes its delivery
            warn!(
                endpoint = notification.endpoint,
                index = notification.index,
                "Bot notification dropped, the bot's queue is full"
            );
            write_metrics(|m| m.incr_bot_notifications_dropped("queue_full"));
        }
    }
}
