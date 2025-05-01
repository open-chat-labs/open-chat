use crate::UserEvent;
use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{IdempotentEnvelope, UserId};
use utils::canister::{is_out_of_cycles_error, should_retry_failed_c2c_call};

grouped_timer_job_batch!(UserEventBatch, UserId, IdempotentEnvelope<UserEvent>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = user_canister_c2c_client::c2c_local_user_index(
            self.key.into(),
            &user_canister::c2c_local_user_index::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_local_user_index::Response::Success) => Ok(()),
            Err(error) => {
                if is_out_of_cycles_error(error.reject_code(), error.message()) {
                    top_up_child_canister(Some(self.key.into())).await;
                }
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
