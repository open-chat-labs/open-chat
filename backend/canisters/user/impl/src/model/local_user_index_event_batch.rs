use crate::LocalUserIndexEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, DirectChatUserNotificationPayload, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(
    LocalUserIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<LocalUserIndexEvent<DirectChatUserNotificationPayload>>,
    100
);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = local_user_index_canister_c2c_client::c2c_user_canister(
            self.state,
            &local_user_index_canister::c2c_user_canister::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(local_user_index_canister::c2c_user_canister::Response::Success) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
