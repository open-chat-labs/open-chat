use crate::LocalUserIndexEvent;
use crate::read_state;
use local_user_index_canister::UserEventWithUserId;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, DirectChatUserNotificationPayload, IdempotentEnvelope, Milliseconds, UserId};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(
    LocalUserIndexEventBatch,
    CanisterId,
    IdempotentEnvelope<LocalUserIndexEvent<DirectChatUserNotificationPayload>>,
    100
);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        // Each event names the user it is from, which for a User canister is always itself
        let user_id: UserId = read_state(|state| state.env.canister_id()).into();
        let response = local_user_index_canister_c2c_client::c2c_user_canister_v2(
            self.state,
            &local_user_index_canister::c2c_user_canister_v2::Args {
                events: self
                    .items
                    .iter()
                    .map(|e| IdempotentEnvelope {
                        created_at: e.created_at,
                        idempotency_id: e.idempotency_id,
                        value: UserEventWithUserId {
                            user_id,
                            event: e.value.clone(),
                        },
                    })
                    .collect(),
            },
        )
        .await;

        match response {
            Ok(local_user_index_canister::c2c_user_canister_v2::Response::Success) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
