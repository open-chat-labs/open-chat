use crate::ic_agent::IcAgent;
use crate::user_notifications::metrics::Metrics;
use crate::user_notifications::processor::Processor;
use crate::user_notifications::pusher::Pusher;
use crate::user_notifications::subscription_remover::SubscriptionRemover;
use crate::{Notification, NotificationToPush};
use async_channel::Sender;
use std::sync::{Arc, RwLock};
use types::CanisterId;

pub mod metrics;
pub mod processor;
pub mod pusher;
pub mod subscription_remover;

pub fn start_user_notifications_processor(
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    vapid_private_pem: String,
    pusher_count: u32,
) -> Sender<Notification> {
    let (to_process_sender, to_process_receiver) = async_channel::bounded::<Notification>(200_000);
    let (to_push_sender, to_push_receiver) = async_channel::bounded::<NotificationToPush>(200_000);
    let (subscriptions_to_remove_sender, subscriptions_to_remove_receiver) = async_channel::bounded(20_000);

    Metrics::init(
        to_process_sender.clone(),
        to_push_sender.clone(),
        subscriptions_to_remove_sender.clone(),
    );

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

    to_process_sender
}
