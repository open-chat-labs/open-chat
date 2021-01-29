use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use crate::domain::user_store::{UserStore, UserSummary};
use self::Response::*;

pub fn query() -> Response {
    let me = shared::user_id::get_current();
    let user_store: &UserStore = storage::get();
    
    match user_store.get_user(&me, None) {
        None => UserNotFound,
        Some(user_summary) => Success(user_summary)
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(UserSummary),
    UserNotFound
}
