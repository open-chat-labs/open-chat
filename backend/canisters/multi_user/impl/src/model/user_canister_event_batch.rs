use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use user_canister::c2c_user_canister_v2::Event;
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

// The direct chat events from this canister's users for users in other canisters, batched per
// canister, so that those for every user a canister holds are sent to it together. They are always
// sent via `c2c_user_canister_v2`, since only it can name a sender other than the calling canister.
grouped_timer_job_batch!(UserCanisterEventBatch, CanisterId, IdempotentEnvelope<Event>, 100);

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = user_canister_c2c_client::c2c_user_canister_v2(
            self.key,
            &user_canister::c2c_user_canister_v2::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(user_canister::c2c_user_canister_v2::Response::Success) => Ok(()),
            // Keep retrying if the recipient's User canister hasn't yet been upgraded to a version
            // with `c2c_user_canister_v2`
            // TODO revert to `delay_if_should_retry_failed_c2c_call` once every User canister has it
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call_to_new_method(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}
