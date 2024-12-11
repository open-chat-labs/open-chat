use timer_job_queues::{TimerJobItem, TimerJobItemGroup};
use types::CanisterId;
use user_index_canister::LocalUserIndexEvent as UserIndexEvent;
use utils::canister::should_retry_failed_c2c_call;

pub struct UserIndexEventBatch {
    canister_id: CanisterId,
    events: Vec<UserIndexEvent>,
}

impl TimerJobItemGroup for UserIndexEventBatch {
    type Key = CanisterId;
    type Item = UserIndexEvent;

    fn new(canister_id: CanisterId) -> Self {
        UserIndexEventBatch {
            canister_id,
            events: Vec::new(),
        }
    }

    fn key(&self) -> CanisterId {
        self.canister_id
    }

    fn add(&mut self, event: UserIndexEvent) {
        self.events.push(event)
    }

    fn into_items(self) -> Vec<UserIndexEvent> {
        self.events
    }

    fn is_full(&self) -> bool {
        self.events.len() >= 1000
    }
}

impl TimerJobItem for UserIndexEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = user_index_canister_c2c_client::c2c_notify_events(
            self.canister_id,
            &user_index_canister::c2c_notify_events::Args {
                events: self.events.clone(),
            },
        )
        .await;

        match response {
            Ok(user_index_canister::c2c_notify_events::Response::Success) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}
