use crate::UserId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub user_id: UserId,
    pub username: String,
}
