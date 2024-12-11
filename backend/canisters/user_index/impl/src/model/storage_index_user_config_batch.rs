use candid::Deserialize;
use serde::Serialize;
use storage_index_canister::add_or_update_users::UserConfig;
use timer_job_queues::{TimerJobItem, TimerJobItemGroup};
use types::CanisterId;
use utils::canister::should_retry_failed_c2c_call;

#[derive(Serialize, Deserialize)]
pub struct StorageIndexUserConfigBatch {
    canister_id: CanisterId,
    users: Vec<UserConfig>,
}

impl TimerJobItem for StorageIndexUserConfigBatch {
    async fn process(&self) -> Result<(), bool> {
        let response = storage_index_canister_c2c_client::add_or_update_users(
            self.canister_id,
            &storage_index_canister::add_or_update_users::Args {
                users: self.users.clone(),
            },
        )
        .await;

        match response {
            Ok(_) => Ok(()),
            Err((code, msg)) => {
                let retry = should_retry_failed_c2c_call(code, &msg);
                Err(retry)
            }
        }
    }
}

impl TimerJobItemGroup for StorageIndexUserConfigBatch {
    type Key = CanisterId;
    type Item = UserConfig;

    fn new(canister_id: Self::Key) -> Self {
        StorageIndexUserConfigBatch {
            canister_id,
            users: Vec::new(),
        }
    }

    fn key(&self) -> Self::Key {
        self.canister_id
    }

    fn add(&mut self, item: Self::Item) {
        self.users.push(item)
    }

    fn into_items(self) -> Vec<Self::Item> {
        self.users
    }

    fn is_full(&self) -> bool {
        self.users.len() > 1000
    }
}
