use crate::ic_agent::IcAgent;
use crate::reader::Reader;
use crate::user_notifications::start_user_notifications_processor;
use index_store::IndexStore;
use prometheus::{Encoder, TextEncoder};
use std::io::Write;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tracing::info;
use types::{CanisterId, TimestampMillis, UserId};
use user_notifications::metrics::collect_metrics;
use web_push::{SubscriptionInfo, WebPushMessage};

pub mod ic_agent;
mod reader;
mod user_notifications;

pub async fn run_notifications_pusher<I: IndexStore + 'static>(
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    notifications_canister_ids: Vec<CanisterId>,
    index_store: I,
    vapid_private_pem: String,
    pusher_count: u32,
) {
    info!("Notifications pusher starting");

    let user_notifications_sender =
        start_user_notifications_processor(ic_agent.clone(), index_canister_id, vapid_private_pem, pusher_count);

    for notification_canister_id in notifications_canister_ids {
        let reader = Reader::new(
            ic_agent.clone(),
            notification_canister_id,
            index_store.clone(),
            user_notifications_sender.clone(),
        );
        tokio::spawn(reader.run());
    }

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
