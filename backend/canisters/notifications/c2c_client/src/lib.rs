use canister_client::generate_c2c_call;
use notifications_canister::c2c_push_notifications::Notification;
use notifications_canister::*;
use serde::{Deserialize, Serialize};
use timer_job_queues::{timer_job_batch, TimerJobItem};
use types::{CanisterId, IdempotentEnvelope};
use utils::canister::should_retry_failed_c2c_call;

// Queries

// Updates
generate_c2c_call!(c2c_push_notifications);
generate_c2c_call!(c2c_notifications_index, 300);

timer_job_batch!(
    NotificationsBatch,
    NotificationPusherState,
    IdempotentEnvelope<Notification>,
    10
);

#[derive(Serialize, Deserialize, Clone)]
pub struct NotificationPusherState {
    pub notifications_canister: CanisterId,
    pub authorizer: CanisterId,
}

impl TimerJobItem for NotificationsBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = c2c_push_notifications(
            self.state.notifications_canister,
            &c2c_push_notifications::Args {
                notifications: self.items.clone(),
                authorizer: Some(self.state.authorizer),
            },
        )
        .await;

        match response {
            Ok(c2c_push_notifications::Response::Success) => Ok(()),
            Ok(c2c_push_notifications::Response::InternalError(_)) => Err(true),
            Ok(c2c_push_notifications::Response::Blocked) => Err(false),
            Err(error) => {
                let retry = should_retry_failed_c2c_call(error.reject_code(), error.message());
                Err(retry)
            }
        }
    }
}
