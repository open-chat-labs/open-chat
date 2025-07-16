use airdrop_bot_canister::c2c_online_users::OnlineUsersEvent;
use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call;

timer_job_batch!(AirdropBotEventBatch, CanisterId, IdempotentEnvelope<OnlineUsersEvent>, 1000);

impl TimerJobItem for AirdropBotEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = airdrop_bot_canister_c2c_client::c2c_online_users(
            self.state,
            &airdrop_bot_canister::c2c_online_users::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(airdrop_bot_canister::c2c_online_users::Response::Success) => Ok(()),
            Err(error) => {
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(delay_if_should_retry)
            }
        }
    }
}
