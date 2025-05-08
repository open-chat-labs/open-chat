use crate::GroupEvent;
use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::{is_out_of_cycles_error, should_retry_failed_c2c_call};

grouped_timer_job_batch!(GroupEventBatch, CanisterId, IdempotentEnvelope<GroupEvent>, 1000);

impl TimerJobItem for GroupEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = group_canister_c2c_client::c2c_local_index(
            self.key,
            &group_canister::c2c_local_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(group_canister::c2c_local_index::Response::Success) => Ok(()),
            Err(error) => {
                if is_out_of_cycles_error(error.reject_code(), error.message()) {
                    top_up_child_canister(Some(self.key)).await;
                }
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
