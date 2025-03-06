use crate::updates::c2c_notify_low_balance::top_up_user;
use crate::UserEvent;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
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
            Err((code, msg)) => {
                if is_out_of_cycles_error(code, &msg) {
                    top_up_user(Some(self.key)).await;
                }
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
