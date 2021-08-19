use self::Response::*;
use crate::domain::user_store::{UserStore, UserSummary};
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::user_id::UserId;
use shared::{timestamp, timestamp::Timestamp};

pub fn query(request: Request) -> Response {
    let me = shared::user_id::get_current();
    let user_store: &UserStore = storage::get();
    let now = timestamp::now();

    let users = user_store.get_users(request.users, &me, request.updated_since, now);

    let result = Result {
        users,
        timestamp: now,
    };

    Success(result)
}

#[derive(Deserialize)]
pub struct Request {
    users: Vec<UserId>,
    updated_since: Option<Timestamp>,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    users: Vec<UserSummary>,
    timestamp: Timestamp,
}
