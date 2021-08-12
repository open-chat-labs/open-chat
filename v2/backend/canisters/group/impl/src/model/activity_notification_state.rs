use types::TimestampMillis;

const ACTIVITY_NOTIFICATION_INTERVAL_MILLIS: u64 = 5 * 60 * 1000; // 5 minutes

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

    pub fn start_if_required(&mut self, now: TimestampMillis) -> bool {
        if self.notification_in_progress
            || self.last_notification_date > now.saturating_sub(ACTIVITY_NOTIFICATION_INTERVAL_MILLIS)
        {
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
