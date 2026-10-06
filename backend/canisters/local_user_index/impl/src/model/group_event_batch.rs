use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use crate::{GroupEvent, read_state};
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

grouped_timer_job_batch!(GroupEventBatch, CanisterId, IdempotentEnvelope<GroupEvent>, 1000);

impl TimerJobItem for GroupEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let args = group_canister::c2c_local_index::Args {
            events: self.items.clone(),
        };
        let response =
            top_up_and_retry_if_out_of_cycles(self.key, || group_canister_c2c_client::c2c_local_index(self.key, &args)).await;

        match response {
            Ok(group_canister::c2c_local_index::Response::Success) => Ok(()),
            Err(error) => {
                // Once the group has been deleted its canister is left uninstalled, so the
                // events could never be delivered
                if read_state(|state| state.data.local_groups.contains(&self.key.into())) {
                    Err(delay_if_should_retry_failed_c2c_call(&error))
                } else {
                    Err(None)
                }
            }
        }
    }
}
