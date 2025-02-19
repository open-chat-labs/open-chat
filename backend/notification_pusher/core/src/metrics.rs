use prometheus::proto::MetricFamily;
use prometheus::{IntCounter, IntGauge, IntGaugeVec, Opts, Registry};
use std::sync::LazyLock;
use types::CanisterId;

pub struct Metrics {
    registry: Registry,
    latest_notification_index_read: IntGaugeVec,
    latest_notification_index_queued: IntGaugeVec,
    latest_notification_index_processed: IntGaugeVec,
    notifications_in_queue: IntGauge,
    notification_latency_ms: IntGaugeVec,
    user_notifications_pushed: IntCounter,
    total_notifications_pushed: IntCounter,
    total_notification_bytes_pushed: IntCounter,
}

pub static METRICS: LazyLock<Metrics> = LazyLock::new(Metrics::new);

impl Metrics {
    fn new() -> Self {
        let latest_notification_index_read = IntGaugeVec::new(
            Opts::new("latest_notification_index_read", "Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let latest_notification_index_queued = IntGaugeVec::new(
            Opts::new("latest_notification_index_queued", "Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let latest_notification_index_processed = IntGaugeVec::new(
            Opts::new("latest_notification_index_processed", "Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let notifications_in_queue = IntGauge::new("notifications_in_queue", "Number of notifications in the queue").unwrap();
        let notification_latency_ms = IntGaugeVec::new(
            Opts::new("notification_latency", "In milliseconds. Per notifications canister"),
            &["canisterId"],
        )
        .unwrap();

        let user_notifications_pushed = IntCounter::new(
            "user_notifications_pushed",
            "Each user notification may be sent to multiple subscriptions",
        )
        .unwrap();

        let total_notifications_pushed =
            IntCounter::new("total_notifications_pushed", "Total count of notifications pushed").unwrap();
        let total_notification_bytes_pushed =
            IntCounter::new("total_notification_bytes_pushed", "Total count of notification bytes pushed").unwrap();

        let registry = Registry::new();
        registry.register(Box::new(latest_notification_index_read.clone())).unwrap();
        registry.register(Box::new(latest_notification_index_queued.clone())).unwrap();
        registry
            .register(Box::new(latest_notification_index_processed.clone()))
            .unwrap();
        registry.register(Box::new(notification_latency_ms.clone())).unwrap();
        registry.register(Box::new(user_notifications_pushed.clone())).unwrap();
        registry.register(Box::new(total_notifications_pushed.clone())).unwrap();

        Metrics {
            registry,
            latest_notification_index_read,
            latest_notification_index_queued,
            latest_notification_index_processed,
            notifications_in_queue,
            notification_latency_ms,
            user_notifications_pushed,
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

    pub fn set_latest_notification_index_queued(&self, index: u64, canister_id: CanisterId) {
        self.latest_notification_index_queued
            .with_label_values(&[&canister_id.to_string()])
            .set(index as i64);
    }

    pub fn set_latest_notification_index_processed(&self, index: u64, canister_id: CanisterId) {
        self.latest_notification_index_processed
            .with_label_values(&[&canister_id.to_string()])
            .set(index as i64);
    }

    pub fn set_notifications_in_queue(&self, count: u64) {
        self.notifications_in_queue.set(count as i64);
    }

    pub fn set_notification_latency_ms(&self, latency_ms: u64, canister_id: CanisterId) {
        self.notification_latency_ms
            .with_label_values(&[&canister_id.to_string()])
            .set(latency_ms as i64);
    }

    pub fn incr_user_notifications_pushed(&self) {
        self.user_notifications_pushed.inc();
    }

    pub fn incr_total_notifications_pushed(&self) {
        self.total_notifications_pushed.inc();
    }

    pub fn incr_total_notification_bytes_pushed(&self, amount: u64) {
        self.total_notification_bytes_pushed.inc_by(amount);
    }
}
