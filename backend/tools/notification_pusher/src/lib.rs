use crate::bot_notifications::start_bot_notifications_processor;
use crate::ic_agent::IcAgent;
use crate::metrics::{Metrics, collect_metrics};
use crate::reader::Reader;
use crate::user_notifications::start_user_notifications_processor;
use index_store::IndexStore;
use prometheus::{Encoder, TextEncoder};
use std::io::Write;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tracing::info;
use types::{CanisterId, TimestampMillis, UserId};
use web_push::{PartialVapidSignatureBuilder, SubscriptionInfo, WebPushMessage};

mod bot_notifications;
pub mod ic_agent;
mod metrics;
mod reader;
mod user_notifications;

pub async fn run_notifications_pusher<I: IndexStore + 'static>(
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    index_store: I,
    sig_builder: PartialVapidSignatureBuilder,
    pusher_threads: u32,
    is_localhost: bool,
) {
    info!("Notifications pusher starting");

    Metrics::init();

    let notification_canister_ids = ic_agent.notification_canisters(index_canister_id).await.unwrap();

    let user_notifications_sender =
        start_user_notifications_processor(ic_agent.clone(), index_canister_id, sig_builder, pusher_threads);

    let bot_notifications_sender = start_bot_notifications_processor(is_localhost);

    for notification_canister_id in notification_canister_ids {
        let reader = Reader::new(
            ic_agent.clone(),
            notification_canister_id,
            index_store.clone(),
            user_notifications_sender.clone(),
            bot_notifications_sender.clone(),
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

pub struct UserNotification {
    notifications_canister: CanisterId,
    index: u64,
    timestamp: TimestampMillis,
    recipient: UserId,
    payload: Arc<Vec<u8>>,
    subscription_info: SubscriptionInfo,
    first_read_at: Instant,
}

pub struct UserNotificationToPush {
    notification: UserNotification,
    message: WebPushMessage,
}

pub struct BotNotification {
    notifications_canister: CanisterId,
    index: u64,
    timestamp: TimestampMillis,
    endpoint: String,
    payload: Payload,
    first_read_at: Instant,
}

pub struct Payload {
    data: Vec<u8>,
    mime_type: String,
}

impl Payload {
    pub fn new(data: Vec<u8>, mime_type: &str) -> Self {
        Self {
            data,
            mime_type: mime_type.to_string(),
        }
    }
}

fn timestamp() -> TimestampMillis {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}
