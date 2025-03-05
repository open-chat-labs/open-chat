use crate::{mutate_state, read_state};
use ic_cdk::api::management_canister::main::CanisterIdRecord;
use std::time::Duration;
use tracing::{info, trace};
use types::{CanisterId, Cycles, Timestamped};
use utils::canister_timers::run_now_then_interval;

const INTERVAL: Duration = Duration::from_secs(24 * 60 * 60); // 1 day
const FREEZING_THRESHOLD_DAYS: u128 = 30;

pub fn start_job() {
    run_now_then_interval(INTERVAL, run);
}

fn run() {
    trace!("'calculate_freezing_limit' job started");
    let this_canister_id = read_state(|state| state.env.canister_id());
    ic_cdk::futures::spawn(run_async(this_canister_id))
}

async fn run_async(this_canister_id: CanisterId) {
    if let Ok(status) = ic_cdk::api::management_canister::main::canister_status(CanisterIdRecord {
        canister_id: this_canister_id,
    })
    .await
    {
        if let Ok(cycles_per_day) = Cycles::try_from(status.0.idle_cycles_burned_per_day.0) {
            let freezing_limit = cycles_per_day * FREEZING_THRESHOLD_DAYS;

            mutate_state(|state| {
                let now = state.env.now();
                state.data.freezing_limit = Timestamped::new(Some(freezing_limit), now);
                info!(freezing_limit, "Freezing limit set");
            });
        }
    }
}
