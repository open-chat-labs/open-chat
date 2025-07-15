use crate::GroupEvent;
use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_out_of_cycles_error};

grouped_timer_job_batch!(GroupEventBatch, CanisterId, IdempotentEnvelope<GroupEvent>, 1000);

impl TimerJobItem for GroupEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
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
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
