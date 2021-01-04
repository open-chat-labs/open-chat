use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;
use crate::domain::user_store::{UserStore, UserSummary};
use self::Response::*;

pub fn query(users: Vec<Request>) -> Response {
    let user_store: &UserStore = storage::get();

    Success(user_store.get_users(users))
}

#[derive(Deserialize)]
pub struct Request {
    pub id: UserId,
    pub cached_version: Option<u32>
}

#[derive(CandidType)]
pub enum Response {
    Success(Vec<UserSummary>)
}
