use crate::ic_agent::IcAgent;
use crate::metrics::{collect_metrics, Metrics};
use crate::processor::Processor;
use crate::pusher::Pusher;
use crate::reader::Reader;
use crate::subscription_remover::SubscriptionRemover;
use index_store::IndexStore;
use prometheus::{Encoder, TextEncoder};
use std::io::Write;
use std::sync::{Arc, RwLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tracing::info;
use types::{CanisterId, TimestampMillis, UserId};
use web_push::{SubscriptionInfo, WebPushMessage};

pub mod ic_agent;
mod metrics;
mod processor;
mod pusher;
mod reader;
mod subscription_remover;

pub async fn run_notifications_pusher<I: IndexStore + 'static>(
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    notifications_canister_ids: Vec<CanisterId>,
    index_store: I,
    vapid_private_pem: String,
    pusher_count: u32,
) {
    info!("Notifications pusher starting");

    let (to_process_sender, to_process_receiver) = async_channel::bounded::<Notification>(200_000);
    let (to_push_sender, to_push_receiver) = async_channel::bounded::<NotificationToPush>(200_000);
    let (subscriptions_to_remove_sender, subscriptions_to_remove_receiver) = async_channel::bounded(20_000);

    Metrics::init(
        to_process_sender.clone(),
        to_push_sender.clone(),
        subscriptions_to_remove_sender.clone(),
    );

    for notification_canister_id in notifications_canister_ids {
        let reader = Reader::new(
            ic_agent.clone(),
            notification_canister_id,
            index_store.clone(),
            to_process_sender.clone(),
        );
        tokio::spawn(reader.run());
    }

    let invalid_subscriptions = Arc::new(RwLock::default());
    let throttled_subscriptions = Arc::new(RwLock::default());

    let processor = Processor::new(
        to_process_receiver.clone(),
        to_push_sender.clone(),
        &vapid_private_pem,
        invalid_subscriptions.clone(),
        throttled_subscriptions.clone(),
    );
    tokio::spawn(processor.run());

    for _ in 0..pusher_count {
        let pusher = Pusher::new(
            to_push_receiver.clone(),
            subscriptions_to_remove_sender.clone(),
            invalid_subscriptions.clone(),
            throttled_subscriptions.clone(),
        );
        tokio::spawn(pusher.run());
    }

    let subscription_remover = SubscriptionRemover::new(ic_agent, index_canister_id, subscriptions_to_remove_receiver);

    tokio::spawn(subscription_remover.run());

    info!("Notifications pusher started");

    std::thread::park();
}

pub fn write_metrics<W: Write>(w: &mut W) {
    let metrics = collect_metrics();
    let encoder = TextEncoder::new();

    encoder.encode(&metrics, w).unwrap();
}

pub struct Notification {
    notifications_canister: CanisterId,
    index: u64,
    timestamp: TimestampMillis,
    recipient: UserId,
    payload: Arc<Vec<u8>>,
    subscription_info: SubscriptionInfo,
    first_read_at: Instant,
}

pub struct NotificationToPush {
    notification: Notification,
    message: WebPushMessage,
}

fn timestamp() -> TimestampMillis {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}
