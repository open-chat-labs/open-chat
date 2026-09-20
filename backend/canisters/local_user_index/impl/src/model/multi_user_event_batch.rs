use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use user_canister::c2c_local_user_index_v2::LocalUserIndexEventForUser;
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_out_of_cycles_error};

// The events for the users of a MultiUser canister are grouped by that canister rather than by the
// user they are for, so that they are sent to it in the order they were created, which is what the
// single idempotency checker it filters them with requires. Each event names the user it is for,
// since the canister holds many.
grouped_timer_job_batch!(
    MultiUserEventBatch,
    CanisterId,
    IdempotentEnvelope<LocalUserIndexEventForUser>,
    1000
);

impl TimerJobItem for MultiUserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = user_canister_c2c_client::c2c_local_user_index_v2(
            self.key,
            &user_canister::c2c_local_user_index_v2::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_local_user_index_v2::Response::Success) => Ok(()),
            Err(error) => {
                if is_out_of_cycles_error(error.reject_code(), error.message()) {
                    top_up_child_canister(Some(self.key)).await;
                }
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
