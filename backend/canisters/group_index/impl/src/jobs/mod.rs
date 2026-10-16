mod calculate_hot_groups;
mod calculate_hotness;
mod calculate_metrics;

pub(crate) fn start() {
    calculate_metrics::start_job();
    calculate_hot_groups::start_job();
    calculate_hotness::start_job();
}
