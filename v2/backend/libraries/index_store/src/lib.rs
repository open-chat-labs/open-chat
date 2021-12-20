mod dummy_store;

pub use dummy_store::DummyStore;

use async_trait::async_trait;
use types::Error;

#[async_trait]
pub trait IndexStore {
    async fn get(&self) -> Result<Option<u64>, Error>;
    async fn set(&self, index: u64) -> Result<(), Error>;
}
