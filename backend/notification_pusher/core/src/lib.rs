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
use types::{CanisterId, FcmData, FcmToken, SubscriptionInfo, TimestampMillis, UserId};
use web_push::WebPushMessage;

mod bot_notifications;
pub mod ic_agent;
mod metrics;
mod reader;
mod user_notifications;

pub struct PusherArgs<I> {
    pub ic_agent: IcAgent,
    pub index_canister_id: CanisterId,
    pub notifications_canister_ids: Vec<CanisterId>,
    pub index_store: I,
    pub vapid_private_pem: String,
    pub pusher_count: u32,
    pub is_production: bool,
    pub gcloud_sa_json_path: String,
}

pub async fn run_notifications_pusher<I: IndexStore + 'static>(args: PusherArgs<I>) {
    info!("Notifications pusher starting");

    let PusherArgs {
        ic_agent,
        index_canister_id,
        notifications_canister_ids,
        index_store,
        vapid_private_pem,
        pusher_count,
        is_production,
        gcloud_sa_json_path,
    } = args;

    Metrics::init();

    let user_notifications_sender = start_user_notifications_processor(
        ic_agent.clone(),
        index_canister_id,
        vapid_private_pem,
        pusher_count,
        gcloud_sa_json_path,
    );

    let bot_notifications_sender = start_bot_notifications_processor(is_production);

    for notification_canister_id in notifications_canister_ids {
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

// Used by reader and processor
pub enum PushNotification {
    UserNotification(UserNotification),
    FcmNotification(FcmNotification),
}

pub struct FcmNotification {
    fcm_data: FcmData,
    fcm_token: FcmToken,
    metadata: NotificationMetadata,
}

pub struct UserNotification {
    payload: Arc<Vec<u8>>,
    subscription_info: SubscriptionInfo,
    metadata: NotificationMetadata,
}

#[derive(Clone)]
pub struct NotificationMetadata {
    index: u64,
    recipient: UserId,
    timestamp: TimestampMillis,
    first_read_at: Instant,
    notifications_canister: CanisterId,
}

// Sent by processor to pusher
pub enum NotificationToPush {
    UserNotificationToPush(UserNotificationToPush),
    FcmNotificationToPush(Box<FcmNotification>),
}

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
