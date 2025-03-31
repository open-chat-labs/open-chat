use crate::UserIndexEvent;
use timer_job_queues::{timer_job_batch, TimerJobItem};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

timer_job_batch!(UserIndexEventBatch, CanisterId, IdempotentEnvelope<UserIndexEvent>, 1000);

impl TimerJobItem for UserIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = user_index_canister_c2c_client::c2c_local_user_index(
            self.args,
            &user_index_canister::c2c_local_user_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_index_canister::c2c_local_user_index::Response::Success) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
