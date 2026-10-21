use crate::{can_borrow_state, run_regular_jobs};
use local_user_index_canister::UserEventWithUserId;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, DirectChatUserNotificationPayload, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

timer_job_batch!(
    LocalUserIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<UserEventWithUserId<DirectChatUserNotificationPayload>>,
    100
);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = local_user_index_canister_c2c_client::c2c_user(
            self.state,
            &local_user_index_canister::c2c_user::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(local_user_index_canister::c2c_user::Response::Success) => Ok(()),
            Err(error) => {
                // A receiver not yet upgraded to take these is retried until it has been
                Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error))
            }
        }
    }
}
