use self::Response::*;
use crate::domain::user_store::{UserStore, UserSummary};
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::Deserialize;
use shared::timestamp;

const MAX_SEARCH_TERM_LENGTH: usize = 25;

pub fn query(request: Request) -> Response {
    let mut search_term = request.search_term;
    search_term.truncate(MAX_SEARCH_TERM_LENGTH);

    let me = shared::user_id::get_current();
    let user_store: &UserStore = storage::get();
    let now = timestamp::now();

    let users = user_store.search_users(search_term, request.max_results, &me, now);

    Success(Result { users })
}

#[derive(Deserialize)]
pub struct Request {
    search_term: String,
    max_results: u8,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    users: Vec<UserSummary>,
}
