use crate::ic_agent::IcAgent;
use crate::metrics::register_metric;
use crate::user_notifications::processor::Processor;
use crate::user_notifications::pusher::Pusher;
use crate::user_notifications::subscription_remover::SubscriptionRemover;
use crate::{NotificationToPush, PushNotification};
use async_channel::Sender;
use prometheus::PullingGauge;
use std::sync::{Arc, RwLock};
use types::{CanisterId, UserId};

mod processor;
mod pusher;
mod subscription_remover;

pub fn start_user_notifications_processor(
    ic_agent: IcAgent,
    index_canister_id: CanisterId,
    vapid_private_pem: String,
    pusher_count: u32,
    gcloud_sa_json_path: String,
) -> Sender<PushNotification> {
    let (to_process_sender, to_process_receiver) = async_channel::bounded::<PushNotification>(200_000);
    let (to_push_sender, to_push_receiver) = async_channel::bounded::<NotificationToPush>(200_000);
    let (subscriptions_to_remove_sender, subscriptions_to_remove_receiver) = async_channel::bounded(20_000);

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
            gcloud_sa_json_path.clone(),
        );
        tokio::spawn(pusher.run());
    }

    let subscription_remover = SubscriptionRemover::new(ic_agent, index_canister_id, subscriptions_to_remove_receiver);

    tokio::spawn(subscription_remover.run());

    register_metrics(to_process_sender.clone(), to_push_sender, subscriptions_to_remove_sender);

    to_process_sender
}

fn register_metrics(
    to_process_sender: Sender<PushNotification>,
    to_push_sender: Sender<NotificationToPush>,
    subscriptions_to_remove_sender: Sender<(UserId, String)>,
) {
    let notifications_to_process_queue = PullingGauge::new(
        "notifications_to_process_queue",
        "Number of notifications queued to be processed",
        Box::new(move || to_process_sender.len() as f64),
    )
    .unwrap();

    let notifications_to_push_queue = PullingGauge::new(
        "notifications_to_push_queue",
        "Number of notifications queued to be pushed",
        Box::new(move || to_push_sender.len() as f64),
    )
    .unwrap();

    let subscriptions_to_remove_queue = PullingGauge::new(
        "subscriptions_to_remove_queue",
        "Number of subscriptions queued to be removed",
        Box::new(move || subscriptions_to_remove_sender.len() as f64),
    )
    .unwrap();

    register_metric(notifications_to_process_queue);
    register_metric(notifications_to_push_queue);
    register_metric(subscriptions_to_remove_queue);
}
