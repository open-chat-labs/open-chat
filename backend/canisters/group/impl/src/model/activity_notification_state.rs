use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, TimestampMillis};

const ONE_MINUTE: Milliseconds = 60 * 1000;

#[derive(CandidType, Serialize, Deserialize)]
pub struct ActivityNotificationState {
    /// When we last notified the group_index canister of activity in this group
    last_notification_date: TimestampMillis,
    notification_in_progress: bool,
}

impl ActivityNotificationState {
    pub fn new(last_notification_date: TimestampMillis) -> ActivityNotificationState {
        ActivityNotificationState {
            last_notification_date,
            notification_in_progress: false,
        }
    }

    pub fn start_if_required(&mut self, now: TimestampMillis, mark_active_duration: Milliseconds) -> bool {
        let interval = mark_active_duration - ONE_MINUTE;
        if self.notification_in_progress || self.last_notification_date > now.saturating_sub(interval) {
            false
        } else {
            self.notification_in_progress = true;
            true
        }
    }

    pub fn mark_succeeded(&mut self, now: TimestampMillis) {
        self.notification_in_progress = false;
        self.last_notification_date = now;
    }

    pub fn mark_failed(&mut self) {
        self.notification_in_progress = false;
    }
}
