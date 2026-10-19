use identity_canister::UserIdentity;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// The queue UserIndex 2.0.2155 synced users to the Identity canister through. Only deserialized from
// that version's state and drained by the post_upgrade one-off, then removed
timer_job_batch!(IdentityUserSyncBatch, CanisterId, UserIdentity, 100);

impl TimerJobItem for IdentityUserSyncBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = identity_canister_c2c_client::c2c_set_user_identities(
            self.state,
            &identity_canister::c2c_set_user_identities::Args {
                users: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
