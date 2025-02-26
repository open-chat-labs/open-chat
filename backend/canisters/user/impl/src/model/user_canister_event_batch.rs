use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::{IdempotentEnvelope, UserId};
use user_canister::UserCanisterEvent;
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(UserCanisterEventBatch, UserId, IdempotentEnvelope<UserCanisterEvent>, 100);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), bool> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = user_canister_c2c_client::c2c_notify_user_canister_events(
            self.key.into(),
            &user_canister::c2c_notify_user_canister_events::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
