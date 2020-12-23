use ic_cdk::export::candid::Principal;
use ic_cdk::storage;
use serde::Deserialize;
use crate::domain::user_store::{UserStore, UserSummary};

pub fn query(users: Vec<GetUserRequest>) -> Vec<UserSummary> {
    let user_store: &UserStore = storage::get();

    user_store.get_users(users)
}

#[derive(Deserialize)]
pub struct GetUserRequest {
    pub id: Principal,
    pub cached_version: Option<u32>
}