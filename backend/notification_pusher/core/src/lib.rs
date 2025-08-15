use crate::bot_notifications::start_bot_notifications_processor;
use crate::config::Config;
use crate::metrics::{Metrics, collect_metrics};
use crate::reader::Reader;
use crate::user_notifications::start_user_notifications_processor;
use index_store::IndexStore;
use prometheus::{Encoder, TextEncoder};
use std::io::Write;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tracing::info;
use types::{CanisterId, FcmData, FcmToken, Payload, SubscriptionInfo, TimestampMillis, UserId};
use web_push::WebPushMessage;

mod bot_notifications;
pub mod config;
pub mod ic_agent;
mod metrics;
mod reader;
mod user_notifications;

pub async fn run_notifications_pusher<I: IndexStore + 'static>(config: Config<I>) {
    info!("Notifications pusher starting");

    Metrics::init();
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    let notification_canister_ids = config
        .ic_agent
        .notification_canisters(config.index_canister_id)
        .await
        .unwrap();

    let user_notifications_sender = start_user_notifications_processor(
        config.ic_agent.clone(),
        config.index_canister_id,
        config.vapid_private_pem,
        config.pusher_count,
        config.fcm_service,
    );

    let bot_notifications_sender = start_bot_notifications_processor(config.is_production);

    for notification_canister_id in notification_canister_ids {
        let reader = Reader::new(
            config.ic_agent.clone(),
            notification_canister_id,
            config.index_store.clone(),
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

// Used by reader and processor
pub enum PushNotification {
    UserNotification(UserNotification),
    FcmNotification(Box<FcmNotification>),
}

#[derive(Debug)]
pub struct FcmNotification {
    fcm_data: Option<FcmData>,
    fcm_token: FcmToken,
    metadata: NotificationMetadata,
}

#[derive(Debug)]
pub struct UserNotification {
    payload: Arc<Vec<u8>>,
    subscription_info: SubscriptionInfo,
    metadata: NotificationMetadata,
}

#[derive(Clone, Debug)]
pub struct NotificationMetadata {
    index: u64,
    recipient: UserId,
    timestamp: TimestampMillis,
    first_read_at: Instant,
    notifications_canister: CanisterId,
}

// Sent by processor to pusher
#[derive(Debug)]
pub enum NotificationToPush {
    UserNotificationToPush(Box<UserNotificationToPush>),
    FcmNotificationToPush(Box<FcmNotification>),
}

#[derive(Debug)]
pub struct UserNotificationToPush {
    notification: UserNotification,
    message: WebPushMessage,
}

// Bot specific notification structs
pub struct BotNotification {
    notifications_canister: CanisterId,
    index: u64,
    timestamp: TimestampMillis,
    endpoint: String,
    payload: Payload,
    first_read_at: Instant,
}

fn timestamp() -> TimestampMillis {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}
