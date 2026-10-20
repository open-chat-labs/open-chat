use timer_job_queues::{TimerJobItem, timer_job_batch};
use types::{CanisterId, IdempotentEnvelope, Milliseconds};
use utils::canister::delay_if_should_retry_failed_c2c_call_to_new_method;

timer_job_batch!(
    RegistryEventBatch,
    CanisterId,
    IdempotentEnvelope<registry_canister::ProposalsBotEvent>,
    1000
);

impl TimerJobItem for RegistryEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let response = registry_canister_c2c_client::c2c_proposals_bot(
            self.state,
            &registry_canister::c2c_proposals_bot::Args {
                events: self.items.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            // A Registry not yet upgraded to take these is retried until it has been
            Err(error) => Err(delay_if_should_retry_failed_c2c_call_to_new_method(&error)),
        }
    }
}
