use constants::DAY_IN_MS;
use storage_bucket_canister::c2c_vault_sync::VaultOp;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds};

// Replaced by an event queue, and drained into it by the post_upgrade one-off. It never sends anything
// itself, so nothing leaves except through the drain, and nothing goes to an endpoint the tidy removes.
// Removed with the one-off.
grouped_timer_job_batch!(VaultEventBatch, CanisterId, VaultOp, 200);

impl TimerJobItem for VaultEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        Err(Some(DAY_IN_MS))
    }
}
