use crate::LocalUserIndexEvent;
use timer_job_queues::{grouped_timer_job, TimerJobItem, TimerJobItemGroup};
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job!(LocalUserIndexEventBatch, CanisterId, LocalUserIndexEvent, 100);

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = local_user_index_canister_c2c_client::c2c_notify_user_events(
            self.key,
            &local_user_index_canister::c2c_notify_user_events::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(local_user_index_canister::c2c_notify_user_events::Response::Success) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
