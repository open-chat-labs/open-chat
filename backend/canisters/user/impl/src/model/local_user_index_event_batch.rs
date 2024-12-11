use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use timer_job_queues::{TimerJobItem, TimerJobItemGroup};
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

pub struct LocalUserIndexEventBatch {
    canister_id: CanisterId,
    events: Vec<LocalUserIndexEvent>,
}

impl TimerJobItemGroup for LocalUserIndexEventBatch {
    type Key = CanisterId;
    type Item = LocalUserIndexEvent;

    fn new(canister_id: CanisterId) -> Self {
        LocalUserIndexEventBatch {
            canister_id,
            events: Vec::new(),
        }
    }

    fn key(&self) -> CanisterId {
        self.canister_id
    }

    fn add(&mut self, event: LocalUserIndexEvent) {
        self.events.push(event)
    }

    fn into_items(self) -> Vec<LocalUserIndexEvent> {
        self.events
    }

    fn is_full(&self) -> bool {
        self.events.len() >= 100
    }
}

impl TimerJobItem for LocalUserIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = local_user_index_canister_c2c_client::c2c_notify_user_events(
            self.canister_id,
            &local_user_index_canister::c2c_notify_user_events::Args {
                events: self.events.clone(),
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
