use crate::{can_borrow_state, run_regular_jobs};
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::{IdempotentC2CCall, UserId};
use user_canister::CommunityCanisterEvent;
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(UserEventBatch, UserId, IdempotentC2CCall<CommunityCanisterEvent>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), bool> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = user_canister_c2c_client::c2c_notify_community_canister_events(
            self.key.into(),
            &user_canister::c2c_notify_community_canister_events::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_notify_community_canister_events::Response::Success) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
