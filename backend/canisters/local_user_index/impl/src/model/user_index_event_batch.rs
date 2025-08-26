use crate::UserIndexEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(UserIndexEventBatch, CanisterId, IdempotentEnvelope<UserIndexEvent>, 1000);

impl TimerJobItem for UserIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = user_index_canister_c2c_client::c2c_local_user_index(
            self.state,
            &user_index_canister::c2c_local_user_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_index_canister::c2c_local_user_index::Response::Success) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
