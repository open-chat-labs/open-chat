use candid::Principal;
use serde::{Deserialize, Serialize};
use types::{AccessorId, FileId};

mod lifecycle;
mod queries;
mod updates;
mod vault_ops;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;
pub use vault_ops::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum StorageIndexEvent {
    UserAdded(Principal),
    UserRemoved(Principal),
    AccessorRemoved(AccessorId),
    FileToRemove(FileId),
    // Boxed so that the small events, of which a new bucket is sent one per user, stay small
    VaultOp(Box<VaultOp>),
}
