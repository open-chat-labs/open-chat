use candid::Principal;
use serde::{Deserialize, Serialize};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    UserDeleted(UserDeleted),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserDeleted {
    pub user_principal: Principal,
}
