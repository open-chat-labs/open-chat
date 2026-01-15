use crate::mutate_state;
use constants::DAY_IN_MS;
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionRemoved};
use std::time::Duration;
use utils::canister_timers::run_now_then_interval;

const INTERVAL: Duration = Duration::from_secs(24 * 60 * 60); // 1 day

pub fn start_job() {
    run_now_then_interval(INTERVAL, run);
}

// Remove all subscriptions that have been inactive for over 90 days
fn run() {
    mutate_state(|state| {
        let now = state.env.now();
        let cutoff = now.saturating_sub(90 * DAY_IN_MS);
        let removed = state.data.subscriptions.remove_inactive(cutoff);

        for (user_id, endpoints) in removed {
            if endpoints.is_empty() {
                state.push_event_to_local_indexes(NotificationsIndexEvent::AllSubscriptionsRemoved(user_id), now);
            } else {
                for endpoint in endpoints {
                    state.push_event_to_local_indexes(
                        NotificationsIndexEvent::SubscriptionRemoved(SubscriptionRemoved { user_id, endpoint }),
                        now,
                    );
                }
            }
        }
    });
}
