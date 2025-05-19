use crate::{can_borrow_state, run_regular_jobs};
use local_user_index_canister::CommunityEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

timer_job_batch!(LocalUserIndexEventBatch, CanisterId, IdempotentEnvelope<CommunityEvent>, 10);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        if can_borrow_state() {
            run_regular_jobs();
        }

        let response = local_user_index_canister_c2c_client::c2c_community_canister(
            self.state,
            &local_user_index_canister::c2c_community_canister::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(local_user_index_canister::c2c_community_canister::Response::Success) => Ok(()),
            Err(error) => {
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
