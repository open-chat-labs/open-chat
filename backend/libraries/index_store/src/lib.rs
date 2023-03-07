mod dummy_store;

pub use dummy_store::DummyStore;

use async_trait::async_trait;
use types::{CanisterId, Error};

#[async_trait]
pub trait IndexStore {
    async fn get(&self, canister_id: CanisterId) -> Result<Option<u64>, Error>;
    async fn set(&self, canister_id: CanisterId, index: u64) -> Result<(), Error>;
}
