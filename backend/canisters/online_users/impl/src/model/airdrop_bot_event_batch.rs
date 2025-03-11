use airdrop_bot_canister::c2c_online_users::OnlineUsersEvent;
use timer_job_queues::{grouped_timer_job_batch, TimerJobItem};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

grouped_timer_job_batch!(AirdropBotEventBatch, CanisterId, IdempotentEnvelope<OnlineUsersEvent>, 1000);

impl TimerJobItem for AirdropBotEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = airdrop_bot_canister_c2c_client::c2c_online_users(
            self.key.into(),
            &airdrop_bot_canister::c2c_online_users::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(airdrop_bot_canister::c2c_online_users::Response::Success) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
