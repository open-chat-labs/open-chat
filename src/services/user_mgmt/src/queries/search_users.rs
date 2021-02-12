use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::{timestamp };
use crate::domain::user_store::{UserStore, UserSummary};
use self::Response::*;

pub fn query(request: Request) -> Response {
    let user_store: &UserStore = storage::get();
    let now = timestamp::now();

    let users = user_store.search_users(request.search_term, request.max_results, now);

    Success(Result {
        users
    })
}

#[derive(Deserialize)]
pub struct Request {
    search_term: String,
    max_results: u8
}

#[derive(CandidType)]
pub enum Response {
    Success(Result)
}

#[derive(CandidType)]
pub struct Result {
    users: Vec<UserSummary>
}
