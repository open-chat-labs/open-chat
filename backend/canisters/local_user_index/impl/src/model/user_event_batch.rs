use crate::UserEvent;
use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{C2CError, CanisterId, IdempotentEnvelope, Milliseconds, UserId};
use utils::canister::delay_if_should_retry_failed_c2c_call;

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(UserEventBatch, CanisterId, IdempotentEnvelope<(UserId, UserEvent)>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let canister_id = self.key;

        let response = top_up_and_retry_if_out_of_cycles(canister_id, || self.send()).await;

        match response {
            Ok(types::SuccessOnly::Success) => Ok(()),
            Err(error) => Err(delay_if_should_retry_failed_c2c_call(&error)),
        }
    }
}

impl UserEventBatch {
    async fn send(&self) -> Result<types::SuccessOnly, C2CError> {
        multi_user_canister_c2c_client::c2c_local_user_index_v2(
            self.key,
            &multi_user_canister::c2c_local_user_index_v2::Args {
                events: self.items.clone(),
            },
        )
        .await
    }
}
