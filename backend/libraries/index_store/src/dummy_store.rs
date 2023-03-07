use crate::IndexStore;
use async_trait::async_trait;
use futures::lock::Mutex;
use std::collections::HashMap;
use types::{CanisterId, Error};

pub struct DummyStore {
    indexes_processed_up_to: Mutex<HashMap<CanisterId, u64>>,
}

impl DummyStore {
    pub fn new(indexes: HashMap<CanisterId, u64>) -> DummyStore {
        DummyStore {
            indexes_processed_up_to: Mutex::new(indexes),
        }
    }
}

#[async_trait]
impl IndexStore for DummyStore {
    async fn get(&self, canister_id: CanisterId) -> Result<Option<u64>, Error> {
        Ok(self.indexes_processed_up_to.lock().await.get(&canister_id).copied())
    }

    async fn set(&self, canister_id: CanisterId, notification_index: u64) -> Result<(), Error> {
        self.indexes_processed_up_to
            .lock()
            .await
            .insert(canister_id, notification_index);
        Ok(())
    }
}
