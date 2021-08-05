use crate::error::Error;
use async_trait::async_trait;
use candid::Principal;

#[async_trait]
pub trait Store {
    async fn get_notification_index_processed_up_to(&self, canister_id: Principal) -> Result<Option<u64>, Error>;

    async fn set_notification_index_processed_up_to(
        &mut self,
        canister_id: Principal,
        notification_index: u64,
    ) -> Result<(), Error>;
}
