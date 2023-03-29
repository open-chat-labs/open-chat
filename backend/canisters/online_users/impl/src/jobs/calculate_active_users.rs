use crate::{mutate_state, ActiveUsers, RuntimeState};
use std::time::Duration;
use types::Milliseconds;
use utils::time::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS};

const ACTIVE_USERS_REFRESH_INTERVAL: Milliseconds = 5 * MINUTE_IN_MS;
const FIVE_MINUTES: Milliseconds = 5 * MINUTE_IN_MS;
const ONE_HOUR: Milliseconds = HOUR_IN_MS;
const ONE_DAY: Milliseconds = DAY_IN_MS;
const SEVEN_DAYS: Milliseconds = 7 * DAY_IN_MS;
const THIRTY_DAYS: Milliseconds = 30 * DAY_IN_MS;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(ACTIVE_USERS_REFRESH_INTERVAL), run);
}

fn run() {
    mutate_state(run_impl);
}

fn run_impl(state: &mut RuntimeState) {
    let now = state.env.now();

    let mut last_5_minutes = 0;
    let mut last_hour = 0;
    let mut last_day = 0;
    let mut last_7_days = 0;
    let mut last_30_days = 0;

    for (_, last_online) in state.data.last_online_dates.iter() {
        let interval_since_last_online = now.saturating_sub(last_online);
        if interval_since_last_online > THIRTY_DAYS {
            continue;
        }
        last_30_days += 1;
        if interval_since_last_online > SEVEN_DAYS {
            continue;
        }
        last_7_days += 1;
        if interval_since_last_online > ONE_DAY {
            continue;
        }
        last_day += 1;
        if interval_since_last_online > ONE_HOUR {
            continue;
        }
        last_hour += 1;
        if interval_since_last_online > FIVE_MINUTES {
            continue;
        }
        last_5_minutes += 1;
    }

    state.data.cached_active_users = ActiveUsers {
        timestamp: now,
        last_5_minutes,
        last_hour,
        last_day,
        last_7_days,
        last_30_days,
    };
}
