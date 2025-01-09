use crate::ic_agent::IcAgent;
use crate::pusher::Pusher;
use crate::reader::Reader;
use crate::subscription_remover::SubscriptionRemover;
use index_store::IndexStore;
use std::sync::{Arc, RwLock};
use tracing::info;
use types::{CanisterId, UserId};
use web_push::SubscriptionInfo;

pub mod ic_agent;
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

    info!("Notifications pusher started");

    std::thread::park();
}

pub struct Notification {
    recipient: UserId,
    payload: Arc<Vec<u8>>,
    subscription_info: SubscriptionInfo,
}
