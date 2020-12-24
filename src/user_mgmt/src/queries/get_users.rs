use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;
use crate::domain::user_store::{UserStore, UserSummary};

pub fn query(users: Vec<GetUserRequest>) -> Vec<UserSummary> {
    let user_store: &UserStore = storage::get();

    user_store.get_users(users)
}

#[derive(Deserialize)]
pub struct GetUserRequest {
    pub id: UserId,
    pub cached_version: Option<u32>
}