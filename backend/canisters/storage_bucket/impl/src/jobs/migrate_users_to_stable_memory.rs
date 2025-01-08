use crate::mutate_state;
use ic_cdk_timers::TimerId;
use std::cell::Cell;
use std::time::Duration;
use tracing::info;

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const INTERVAL: Duration = Duration::from_secs(60); // 1 minute

pub fn start_job() {
    let timer_id = ic_cdk_timers::set_timer_interval(INTERVAL, run);
    TIMER_ID.set(Some(timer_id));
}

fn run() {
    info!("'migrate_users_to_stable_memory' job running");

    mutate_state(|state| {
        if state.data.users.migrate_users() {
            state.data.users_migrated = true;

            if let Some(timer_id) = TIMER_ID.take() {
                ic_cdk_timers::clear_timer(timer_id);
            }
        }
    })
}
