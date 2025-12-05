use crate::UserEvent;
use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{IdempotentEnvelope, Milliseconds, UserId};
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_out_of_cycles_error};

grouped_timer_job_batch!(UserEventBatch, UserId, IdempotentEnvelope<UserEvent>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = user_canister_c2c_client::c2c_local_user_index(
            self.key.into(),
            &user_canister::c2c_local_user_index::Args {
                events: self
                    .items
                    .iter()
                    // TODO remove this filter once User canisters have been released
                    .filter(|e| !matches!(e.value, UserEvent::BotUpdated(_)))
                    .cloned()
                    .collect(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_local_user_index::Response::Success) => Ok(()),
            Err(error) => {
                if is_out_of_cycles_error(error.reject_code(), error.message()) {
                    top_up_child_canister(Some(self.key.into())).await;
                }
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
