use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, TimestampMillis};

const ONE_MINUTE: Milliseconds = 60 * 1000;

#[derive(CandidType, Serialize, Deserialize)]
pub struct ActivityNotificationState {
    /// When we last notified the group_index canister of activity in this group
    last_notification_date: TimestampMillis,
    #[serde(default = "default_mark_active_duration")]
    mark_active_duration: Milliseconds,
}

fn default_mark_active_duration() -> Milliseconds {
    10 * ONE_MINUTE
}

impl ActivityNotificationState {
    pub fn new(last_notification_date: TimestampMillis, mark_active_duration: Milliseconds) -> ActivityNotificationState {
        ActivityNotificationState {
            last_notification_date,
            mark_active_duration,
        }
    }

    pub fn notify_if_required(&mut self, now: TimestampMillis) -> Option<Milliseconds> {
        let interval = self.mark_active_duration - ONE_MINUTE;
        if self.last_notification_date > now.saturating_sub(interval) {
            None
        } else {
            Some(self.notify(now))
        }
    }

    pub fn notify(&mut self, now: TimestampMillis) -> Milliseconds {
        self.last_notification_date = now;
        self.mark_active_duration
    }
}
