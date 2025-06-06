use prometheus::core::Collector;
use prometheus::proto::MetricFamily;
use prometheus::{HistogramOpts, HistogramVec, IntGaugeVec, Opts, Registry};
use std::sync::OnceLock;
use types::{CanisterId, Milliseconds};

const BASE_BUCKETS: [f64; 13] = [
    1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0, 2000.0, 5000.0, 10000.0,
];

pub struct Metrics {
    registry: Registry,
    latest_notification_index_read: IntGaugeVec,
    latest_notification_index_processed: IntGaugeVec,
    latest_notification_index_pushed: IntGaugeVec,
    end_to_end_latency_ms: HistogramVec,
    end_to_end_internal_latency_ms: HistogramVec,
    processing_duration_ms: HistogramVec,
    http_post_notification_duration_ms: HistogramVec,
    notification_payload_sizes: HistogramVec,
}

static METRICS: OnceLock<Metrics> = OnceLock::new();

pub fn write_metrics<F: FnOnce(&Metrics)>(f: F) {
    f(METRICS.get().unwrap());
}

pub fn collect_metrics() -> Vec<MetricFamily> {
    METRICS.get().map(|m| m.collect()).unwrap_or_default()
}

pub fn register_metric<C: Collector + 'static>(collector: C) {
    METRICS.get().unwrap().registry.register(Box::new(collector)).unwrap();
}

impl Metrics {
    pub fn init() {
        let metrics = Metrics::new();

        METRICS.set(metrics).map_err(|_| ()).unwrap();
    }

    fn new() -> Self {
        let registry = Registry::new();

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
            &["type", "canisterId"],
        )
        .unwrap();

        let end_to_end_internal_latency_ms = HistogramVec::new(
            HistogramOpts::new("end_to_end_internal_latency", "In milliseconds").buckets(calc_buckets(10.0)),
            &["type"],
        )
        .unwrap();

        let processing_duration_ms = HistogramVec::new(
            HistogramOpts::new("processing_duration", "In milliseconds").buckets(calc_buckets(0.01)),
            &["success"],
        )
        .unwrap();

        let http_post_notification_duration_ms = HistogramVec::new(
            HistogramOpts::new("http_post_notification_duration", "In milliseconds").buckets(calc_buckets(10.0)),
            &["type", "success"],
        )
        .unwrap();

        let notification_payload_sizes = HistogramVec::new(
            HistogramOpts::new("notification_payload_sizes", "The size of notification payloads in bytes")
                .buckets(calc_buckets(1.0)),
            &["type"],
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
            .register(Box::new(http_post_notification_duration_ms.clone()))
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
            http_post_notification_duration_ms,
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

    pub fn observe_end_to_end_latency(&self, latency: Milliseconds, user_notification: bool, canister_id: CanisterId) {
        self.end_to_end_latency_ms
            .with_label_values(&[type_label(user_notification), &canister_id.to_string()])
            .observe(latency as f64);
    }

    pub fn observe_end_to_end_internal_latency(&self, latency: Milliseconds, user_notification: bool) {
        self.end_to_end_internal_latency_ms
            .with_label_values(&[type_label(user_notification)])
            .observe(latency as f64);
    }

    pub fn observe_processing_duration(&self, latency: Milliseconds, success: bool) {
        self.processing_duration_ms
            .with_label_values(&[&success.to_string()])
            .observe(latency as f64);
    }

    pub fn observe_http_post_notification_duration(&self, latency: Milliseconds, user_notification: bool, success: bool) {
        self.http_post_notification_duration_ms
            .with_label_values(&[type_label(user_notification), &success.to_string()])
            .observe(latency as f64);
    }

    pub fn observe_notification_payload_size(&self, size: u64, user_notification: bool) {
        self.notification_payload_sizes
            .with_label_values(&[type_label(user_notification)])
            .observe(size as f64);
    }
}

fn calc_buckets(multiplication_factor: f64) -> Vec<f64> {
    BASE_BUCKETS.into_iter().map(|b| b * multiplication_factor).collect()
}

fn type_label(user_notification: bool) -> &'static str {
    if user_notification { "user" } else { "bot" }
}
