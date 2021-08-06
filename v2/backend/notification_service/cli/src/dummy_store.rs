use async_trait::async_trait;
use candid::Principal;
use shared::error::Error;
use shared::store::Store;

pub struct DummyStore {
    index_processed_up_to: u64,
}

impl DummyStore {
    pub fn new(initial_index: u64) -> DummyStore {
        DummyStore {
            index_processed_up_to: initial_index,
        }
    }
}

#[async_trait]
impl Store for DummyStore {
    async fn get_notification_index_processed_up_to(&self, _canister_id: Principal) -> Result<Option<u64>, Error> {
        Ok(Some(self.index_processed_up_to))
    }

    async fn set_notification_index_processed_up_to(
        &mut self,
        _canister_id: Principal,
        notification_index: u64,
    ) -> Result<(), Error> {
        self.index_processed_up_to = notification_index;
        Ok(())
    }
}
