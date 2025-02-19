use crate::ic_agent::IcAgent;
use crate::metrics::METRICS;
use crate::pusher::Pusher;
use crate::reader::Reader;
use crate::subscription_remover::SubscriptionRemover;
use async_channel::Sender;
use index_store::IndexStore;
use prometheus::{Encoder, TextEncoder};
use std::io::Write;
use std::sync::{Arc, RwLock};
use tokio::time;
use tracing::info;
use types::{CanisterId, TimestampMillis, UserId};
use web_push::SubscriptionInfo;

pub mod ic_agent;
mod metrics;
mod pusher;
mod reader;
mod subscription_remover;

pub async fn run_notifications_pusher<I: IndexStore + 'static>(
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    notifications_canister_ids: Vec<CanisterId>,
    index_store: I,
    vapid_private_pem: String,
    pusher_count: usize,
) {
    info!("Notifications pusher starting");

    let (sender, receiver) = async_channel::bounded::<Notification>(200_000);
    let (subscriptions_to_remove_sender, subscriptions_to_remove_receiver) = async_channel::bounded(20_000);

    for notification_canister_id in notifications_canister_ids {
        let reader = Reader::new(
            ic_agent.clone(),
            notification_canister_id,
            index_store.clone(),
            sender.clone(),
        );
        tokio::spawn(reader.run());
    }

    let invalid_subscriptions = Arc::new(RwLock::default());
    let throttled_subscriptions = Arc::new(RwLock::default());
    for _ in 0..pusher_count {
        let pusher = Pusher::new(
            receiver.clone(),
            &vapid_private_pem,
            subscriptions_to_remove_sender.clone(),
            invalid_subscriptions.clone(),
            throttled_subscriptions.clone(),
        );
        tokio::spawn(pusher.run());
    }

    let subscription_remover = SubscriptionRemover::new(ic_agent, index_canister_id, subscriptions_to_remove_receiver);

    tokio::spawn(subscription_remover.run());
    tokio::spawn(run_queue_monitor_thread(sender));

    info!("Notifications pusher started");

    std::thread::park();
}

pub fn write_metrics<W: Write>(w: &mut W) {
    let metrics = METRICS.collect();
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
}

async fn run_queue_monitor_thread(sender: Sender<Notification>) {
    let mut interval = time::interval(time::Duration::from_secs(20));

    loop {
        interval.tick().await;

        METRICS.set_notifications_in_queue(sender.len() as u64);
    }
}
