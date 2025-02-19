use crate::{Notification, NotificationToPush};
use async_channel::Sender;
use prometheus::proto::MetricFamily;
use prometheus::{IntCounter, IntGaugeVec, Opts, PullingGauge, Registry};
use std::sync::OnceLock;
use types::{CanisterId, UserId};

pub struct Metrics {
    registry: Registry,
    latest_notification_index_read: IntGaugeVec,
    latest_notification_index_processed: IntGaugeVec,
    latest_notification_index_pushed: IntGaugeVec,
    notification_latency_ms: IntGaugeVec,
    total_notifications_pushed: IntCounter,
    total_notification_bytes_pushed: IntCounter,
}

static METRICS: OnceLock<Metrics> = OnceLock::new();

pub fn write_metrics<F: FnOnce(&Metrics)>(f: F) {
    f(METRICS.get().unwrap());
}

pub fn collect_metrics() -> Vec<MetricFamily> {
    METRICS.get().map(|m| m.collect()).unwrap_or_default()
}

impl Metrics {
    pub fn init(
        to_process_sender: Sender<Notification>,
        to_push_sender: Sender<NotificationToPush>,
        subscriptions_to_remove_sender: Sender<(UserId, String)>,
    ) {
        let metrics = Metrics::new(to_process_sender, to_push_sender, subscriptions_to_remove_sender);

        METRICS.set(metrics).map_err(|_| ()).unwrap();
    }

    fn new(
        to_process_sender: Sender<Notification>,
        to_push_sender: Sender<NotificationToPush>,
        subscriptions_to_remove_sender: Sender<(UserId, String)>,
    ) -> Self {
        let registry = Registry::new();

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

        registry.register(Box::new(notifications_to_process_queue.clone())).unwrap();
        registry.register(Box::new(notifications_to_push_queue.clone())).unwrap();
        registry.register(Box::new(subscriptions_to_remove_queue.clone())).unwrap();

        let latest_notification_index_read = IntGaugeVec::new(
            Opts::new("latest_notification_index_read", "Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let latest_notification_index_processed = IntGaugeVec::new(
            Opts::new("latest_notification_index_processed", "Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let latest_notification_index_pushed = IntGaugeVec::new(
            Opts::new("latest_notification_index_pushed", "Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let notification_latency_ms = IntGaugeVec::new(
            Opts::new("notification_latency", "In milliseconds. Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let total_notifications_pushed =
            IntCounter::new("total_notifications_pushed", "Total count of notifications pushed").unwrap();
        let total_notification_bytes_pushed =
            IntCounter::new("total_notification_bytes_pushed", "Total count of notification bytes pushed").unwrap();

        registry.register(Box::new(latest_notification_index_read.clone())).unwrap();
        registry
            .register(Box::new(latest_notification_index_processed.clone()))
            .unwrap();
        registry.register(Box::new(latest_notification_index_pushed.clone())).unwrap();
        registry.register(Box::new(notification_latency_ms.clone())).unwrap();
        registry.register(Box::new(total_notifications_pushed.clone())).unwrap();
        registry.register(Box::new(total_notification_bytes_pushed.clone())).unwrap();

        Metrics {
            registry,
            latest_notification_index_read,
            latest_notification_index_processed,
            latest_notification_index_pushed,
            notification_latency_ms,
            total_notifications_pushed,
            total_notification_bytes_pushed,
        }
    }

    pub fn collect(&self) -> Vec<MetricFamily> {
        self.registry.gather()
    }

    pub fn set_latest_notification_index_read(&self, index: u64, canister_id: CanisterId) {
        self.latest_notification_index_read
            .with_label_values(&[&canister_id.to_string()])
            .set(index as i64);
    }

    pub fn set_latest_notification_index_processed(&self, index: u64, canister_id: CanisterId) {
        self.latest_notification_index_processed
            .with_label_values(&[&canister_id.to_string()])
            .set(index as i64);
    }

    pub fn set_latest_notification_index_pushed(&self, index: u64, canister_id: CanisterId) {
        self.latest_notification_index_pushed
            .with_label_values(&[&canister_id.to_string()])
            .set(index as i64);
    }

    pub fn set_notification_latency_ms(&self, latency_ms: u64, canister_id: CanisterId) {
        self.notification_latency_ms
            .with_label_values(&[&canister_id.to_string()])
            .set(latency_ms as i64);
    }

    pub fn incr_total_notifications_pushed(&self) {
        self.total_notifications_pushed.inc();
    }

    pub fn incr_total_notification_bytes_pushed(&self, amount: u64) {
        self.total_notification_bytes_pushed.inc_by(amount);
    }
}
