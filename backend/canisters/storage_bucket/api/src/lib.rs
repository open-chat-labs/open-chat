use candid::Principal;
use serde::{Deserialize, Serialize};
use types::{AccessorId, FileId};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum StorageIndexEvent {
    UserAdded(Principal),
    UserRemoved(Principal),
    AccessorRemoved(AccessorId),
    FileToRemove(FileId),
    VaultOp(c2c_vault_sync::VaultOp),
}
