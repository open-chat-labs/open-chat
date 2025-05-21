use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{IdempotentEnvelope, UserId};
use user_canister::CommunityCanisterEvent;
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(UserEventBatch, UserId, IdempotentEnvelope<CommunityCanisterEvent>, 100);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), bool> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = user_canister_c2c_client::c2c_community_canister(
            self.key.into(),
            &user_canister::c2c_community_canister::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_community_canister::Response::Success) => Ok(()),
            Err(error) => {
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
