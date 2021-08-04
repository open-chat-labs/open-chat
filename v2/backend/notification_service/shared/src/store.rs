use async_trait::async_trait;
use shared::error::Error;
use shared::types::CanisterId;

#[async_trait]
pub trait Store {
    async fn get_notification_index_processed_up_to(&self, canister_id: CanisterId) -> Result<Option<u64>, Error>;

    async fn set_notification_index_processed_up_to(
        &self,
        canister_id: CanisterId,
        notification_index: u64,
    ) -> Result<(), Error>;
}
