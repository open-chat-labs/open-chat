use constants::DAY_IN_MS;
use storage_index_canister::add_or_update_users::UserConfig;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, Milliseconds};

// Replaced by an event queue, and drained into it by the post_upgrade one-off. It never sends anything
// itself, so nothing leaves except through the drain, and nothing goes to an endpoint the tidy removes.
// Removed with the one-off.
timer_job_batch!(StorageIndexUserConfigBatch, CanisterId, UserConfig, 1000);

impl TimerJobItem for StorageIndexUserConfigBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        Err(Some(DAY_IN_MS))
    }
}
