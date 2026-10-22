use constants::DAY_IN_MS;
use identity_canister::UserIdentity;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, Milliseconds};

// The queue UserIndex 2.0.2155 synced users to the Identity canister through. Only
// deserialized from that version's state, which the post_upgrade one-off drains at once. It never
// sends anything itself, so the upgrade test can only pass through the drain, and nothing goes to an
// endpoint the tidy removes. Removed with the one-off.
timer_job_batch!(IdentityUserSyncBatch, CanisterId, UserIdentity, 100);

impl TimerJobItem for IdentityUserSyncBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        Err(Some(DAY_IN_MS))
    }
}
