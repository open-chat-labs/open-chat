use online_users_canister::UserIndexEvent as OnlineUsersEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(OnlineUsersEventBatch, CanisterId, IdempotentEnvelope<OnlineUsersEvent>, 1000);

impl TimerJobItem for OnlineUsersEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = online_users_canister_c2c_client::c2c_user_index(
            self.state,
            &online_users_canister::c2c_user_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => Err(delay_if_should_retry_failed_c2c_call(&error)),
        }
    }
}
