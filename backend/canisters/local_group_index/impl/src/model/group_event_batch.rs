use crate::updates::c2c_notify_low_balance::top_up_canister;
use crate::GroupEvent;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::CanisterId;
use utils::canister::{is_out_of_cycles_error, should_retry_failed_c2c_call};

grouped_timer_job_batch!(GroupEventBatch, CanisterId, GroupEvent, 1000);

impl TimerJobItem for GroupEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = group_canister_c2c_client::c2c_notify_events(
            self.key,
            &group_canister::c2c_notify_events::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(group_canister::c2c_notify_events::Response::Success) => Ok(()),
            Err((code, msg)) => {
                if is_out_of_cycles_error(code, &msg) {
                    top_up_canister(Some(self.key)).await;
                }
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
