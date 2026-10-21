mod dummy_store;

pub use dummy_store::DummyStore;

use async_trait::async_trait;
use types::Error;

// Stores how far along a stream of events each reader has got, eg. a notifications canister's
// user notifications, keyed by the canister id
#[async_trait]
pub trait IndexStore: Clone + Send + Sync {
    async fn get(&self, key: &str) -> Result<Option<u64>, Error>;
    async fn set(&self, key: &str, index: u64) -> Result<(), Error>;
}
