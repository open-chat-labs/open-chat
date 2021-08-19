use self::Response::*;
use crate::domain::user_store::{MyProfile, UserStore};
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;

pub fn query() -> Response {
    let me = shared::user_id::get_current();
    let user_store: &UserStore = storage::get();

    match user_store.get_my_profile(&me) {
        None => UserNotFound,
        Some(my_profile) => Success(my_profile),
    }
}

#[derive(CandidType)]
pub enum Response {
    Success(MyProfile),
    UserNotFound,
}
