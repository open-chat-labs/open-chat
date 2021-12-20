use crate::IndexStore;
use async_trait::async_trait;
use futures::lock::Mutex;
use types::Error;

pub struct DummyStore {
    index_processed_up_to: Mutex<Option<u64>>,
}

impl DummyStore {
    pub fn new(initial_index: Option<u64>) -> DummyStore {
        DummyStore {
            index_processed_up_to: Mutex::new(initial_index),
        }
    }
}

#[async_trait]
impl IndexStore for DummyStore {
    async fn get(&self) -> Result<Option<u64>, Error> {
        Ok(*self.index_processed_up_to.lock().await)
    }

    async fn set(&self, notification_index: u64) -> Result<(), Error> {
        *self.index_processed_up_to.lock().await = Some(notification_index);
        Ok(())
    }
}
