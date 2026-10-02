use crate::CommunityEvent;
use crate::updates::c2c_notify_low_balance::top_up_and_retry_if_out_of_cycles;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

grouped_timer_job_batch!(CommunityEventBatch, CanisterId, IdempotentEnvelope<CommunityEvent>, 1000);

impl TimerJobItem for CommunityEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let args = community_canister::c2c_local_index::Args {
            events: self.items.clone(),
        };
        let response =
            top_up_and_retry_if_out_of_cycles(self.key, || community_canister_c2c_client::c2c_local_index(self.key, &args))
                .await;

        match response {
            Ok(community_canister::c2c_local_index::Response::Success) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
