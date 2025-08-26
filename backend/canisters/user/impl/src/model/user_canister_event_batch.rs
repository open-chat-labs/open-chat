use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{IdempotentEnvelope, Milliseconds, UserId};
use user_canister::UserCanisterEvent;
use utils::canister::delay_if_should_retry_failed_c2c_call;

grouped_timer_job_batch!(UserCanisterEventBatch, UserId, IdempotentEnvelope<UserCanisterEvent>, 100);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = user_canister_c2c_client::c2c_user_canister(
            self.key.into(),
            &user_canister::c2c_user_canister::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
