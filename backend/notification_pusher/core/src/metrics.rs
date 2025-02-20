use crate::{Notification, NotificationToPush};
use async_channel::Sender;
use prometheus::proto::MetricFamily;
use prometheus::{Histogram, HistogramOpts, HistogramVec, IntGaugeVec, Opts, PullingGauge, Registry};
use std::sync::OnceLock;
use types::{CanisterId, Milliseconds, UserId};

const BASE_BUCKETS: [f64; 13] = [
    1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0, 5000.0, 10000.0,
];

pub struct Metrics {
    registry: Registry,
    latest_notification_index_read: IntGaugeVec,
    latest_notification_index_processed: IntGaugeVec,
    latest_notification_index_pushed: IntGaugeVec,
    end_to_end_latency_ms: HistogramVec,
    end_to_end_internal_latency_ms: Histogram,
    processing_duration_ms: HistogramVec,
    send_web_push_message_duration_ms: HistogramVec,
    notification_payload_sizes: Histogram,
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

        let end_to_end_latency_ms = HistogramVec::new(
            HistogramOpts::new("end_to_end_latency", "In milliseconds. Per notifications canister")
                .buckets(calc_buckets(1000.0)),
            &["canisterId"],
        )
        .unwrap();

        let end_to_end_internal_latency_ms = Histogram::with_opts(
            HistogramOpts::new("end_to_end_internal_latency", "In milliseconds").buckets(calc_buckets(10.0)),
        )
        .unwrap();

        let processing_duration_ms = HistogramVec::new(
            HistogramOpts::new("processing_duration", "In milliseconds").buckets(calc_buckets(0.01)),
            &["success"],
        )
        .unwrap();

        let send_web_push_message_duration_ms = HistogramVec::new(
            HistogramOpts::new("send_web_push_message_duration", "In milliseconds").buckets(calc_buckets(10.0)),
            &["success"],
        )
        .unwrap();

        let notification_payload_sizes = Histogram::with_opts(
            HistogramOpts::new("notification_payload_sizes", "The size of notification payloads in bytes")
                .buckets(calc_buckets(1.0)),
        )
        .unwrap();

        registry.register(Box::new(latest_notification_index_read.clone())).unwrap();
        registry
            .register(Box::new(latest_notification_index_processed.clone()))
            .unwrap();
        registry.register(Box::new(latest_notification_index_pushed.clone())).unwrap();
        registry.register(Box::new(end_to_end_latency_ms.clone())).unwrap();
        registry.register(Box::new(end_to_end_internal_latency_ms.clone())).unwrap();
        registry.register(Box::new(processing_duration_ms.clone())).unwrap();
        registry
            .register(Box::new(send_web_push_message_duration_ms.clone()))
            .unwrap();
        registry.register(Box::new(notification_payload_sizes.clone())).unwrap();

        Metrics {
            registry,
            latest_notification_index_read,
            latest_notification_index_processed,
            latest_notification_index_pushed,
            end_to_end_latency_ms,
            end_to_end_internal_latency_ms,
            processing_duration_ms,
            send_web_push_message_duration_ms,
            notification_payload_sizes,
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

    pub fn observe_end_to_end_latency(&self, latency: Milliseconds, canister_id: CanisterId) {
        self.end_to_end_latency_ms
            .with_label_values(&[&canister_id.to_string()])
            .observe(latency as f64);
    }

    pub fn observe_end_to_end_internal_latency(&self, latency: Milliseconds) {
        self.end_to_end_internal_latency_ms.observe(latency as f64);
    }

    pub fn observe_processing_duration(&self, latency: Milliseconds, success: bool) {
        self.processing_duration_ms
            .with_label_values(&[&success.to_string()])
            .observe(latency as f64);
    }

    pub fn observe_send_web_push_message_duration(&self, latency: Milliseconds, success: bool) {
        self.send_web_push_message_duration_ms
            .with_label_values(&[&success.to_string()])
            .observe(latency as f64);
    }

    pub fn observe_notification_payload_size(&self, size: u64) {
        self.notification_payload_sizes.observe(size as f64);
    }
}

fn calc_buckets(multiplication_factor: f64) -> Vec<f64> {
    BASE_BUCKETS.into_iter().map(|b| b * multiplication_factor).collect()
}
