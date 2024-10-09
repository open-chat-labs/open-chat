use candid::Deserialize;
use serde::Serialize;
use timer_job_queues::{TimerJobItem, TimerJobItemGroup};
use types::UserId;
use user_canister::UserCanisterEvent;

#[derive(Serialize, Deserialize)]
pub struct UserCanisterEventBatch {
    user_id: UserId,
    events: Vec<UserCanisterEvent>,
}

impl TimerJobItem for UserCanisterEventBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = user_canister_c2c_client::c2c_notify_user_canister_events(
            self.user_id.into(),
            &user_canister::c2c_notify_user_canister_events::Args {
                events: self.events.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err(_) => Err(true),
        }
    }
}

impl TimerJobItemGroup for UserCanisterEventBatch {
    type Key = UserId;
    type Item = UserCanisterEvent;

    fn new(user_id: Self::Key) -> Self {
        UserCanisterEventBatch {
            user_id,
            events: Vec::new(),
        }
    }

    fn key(&self) -> Self::Key {
        self.user_id
    }

    fn add(&mut self, item: Self::Item) {
        self.events.push(item)
    }

    fn into_items(self) -> Vec<Self::Item> {
        self.events
    }

    fn is_full(&self) -> bool {
        self.events.len() > 100
    }
}
