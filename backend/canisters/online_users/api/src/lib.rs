use candid::Principal;
use serde::{Deserialize, Serialize};
use types::UserId;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    UserDeleted(UserDeleted),
    UserIdMigrated(UserIdMigrated),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserDeleted {
    pub user_principal: Principal,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserIdMigrated {
    pub user_principal: Principal,
    pub old_user_id: UserId,
    pub new_user_id: UserId,
}
