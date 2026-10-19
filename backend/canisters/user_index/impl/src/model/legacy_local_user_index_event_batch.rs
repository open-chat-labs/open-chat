use crate::LocalUserIndexEvent;
use constants::DAY_IN_MS;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds};

// The queue UserIndex 2.0.2155 sent to the LocalUserIndexes through, with unwrapped events. Only
// deserialized from that version's state, which the post_upgrade one-off drains at once. It never
// sends anything itself, so the upgrade test can only pass through the drain, and nothing goes to an
// endpoint the tidy removes. Removed with the one-off.
grouped_timer_job_batch!(LegacyLocalUserIndexEventBatch, CanisterId, LocalUserIndexEvent, 1000);

impl TimerJobItem for LegacyLocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        Err(Some(DAY_IN_MS))
    }
}
