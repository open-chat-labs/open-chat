use crate::read_state;
use std::time::Duration;
use tracing::{info, trace};
use utils::cycles::send_low_balance_notification;

const INTERVAL: Duration = Duration::from_secs(60 * 60); // 1 hour

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(INTERVAL, run);

    // Run the job in 1 minute, this gives time for the `freezing_limit` to first be calculated and
    // ensures there is never a gap of more than 1 hour.
    ic_cdk_timers::set_timer(Duration::from_secs(60), run);
}

fn run() {
    trace!("'check_cycles_balance' job started");

    read_state(|state| {
        if let Some(freezing_limit) = state.data.freezing_limit.value {
            let cycles_balance = state.env.cycles_balance();

            if cycles_balance < 2 * freezing_limit {
                info!("Requesting cycles top up");
                ic_cdk::spawn(send_low_balance_notification(state.data.storage_index_canister_id));
            }
        }
    });
}
