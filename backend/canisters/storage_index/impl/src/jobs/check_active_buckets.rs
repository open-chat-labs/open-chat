use crate::{mutate_state, read_state};
use constants::{HOUR_IN_MS, MINUTE_IN_MS};
use std::time::Duration;
use tracing::trace;
use types::CanisterId;
use utils::canister_timers::run_now_then_interval;

const INTERVAL: Duration = Duration::from_millis((24 * HOUR_IN_MS) + 31 * MINUTE_IN_MS);

pub fn start_job() {
    run_now_then_interval(INTERVAL, run);
}

fn run() {
    trace!("'check_active_buckets' job started");
    let buckets = read_state(|state| state.data.buckets.iter_active_buckets().map(|b| b.canister_id).collect());
    utils::async_work::spawn_tracked(run_async(buckets));
}

async fn run_async(buckets: Vec<CanisterId>) {
    for bucket in buckets {
        if let Ok(status) = utils::canister::canister_status(bucket).await {
            // If the subnet memory has grown to the stage where canisters are now having to pay
            // reserved cycles when requesting additional memory pages, then mark the bucket as full
            if status.reserved_cycles > 0u32 {
                mutate_state(|state| state.data.buckets.set_full(bucket, true));
            }
        }
    }
}
