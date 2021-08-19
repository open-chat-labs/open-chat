use self::Response::*;
use crate::domain::user_store::UserStore;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::user_id::UserId;

pub fn query(username: &String) -> Response {
    let user_store: &UserStore = storage::get();

    match user_store.get_user_id(username) {
        None => UserNotFound,
        Some(user_id) => Success(user_id),
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(UserId),
    UserNotFound,
}
