use crate::IndexStore;
use async_trait::async_trait;
use futures::lock::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use types::Error;

#[derive(Clone, Default)]
pub struct DummyStore {
    indexes_processed_up_to: Arc<Mutex<HashMap<String, u64>>>,
}

impl DummyStore {
    pub fn new(indexes: HashMap<String, u64>) -> DummyStore {
        DummyStore {
            indexes_processed_up_to: Arc::new(Mutex::new(indexes)),
        }
    }
}

#[async_trait]
impl IndexStore for DummyStore {
    async fn get(&self, key: &str) -> Result<Option<u64>, Error> {
        Ok(self.indexes_processed_up_to.lock().await.get(key).copied())
    }

    async fn set(&self, key: &str, notification_index: u64) -> Result<(), Error> {
        self.indexes_processed_up_to
            .lock()
            .await
            .insert(key.to_string(), notification_index);
        Ok(())
    }
}
