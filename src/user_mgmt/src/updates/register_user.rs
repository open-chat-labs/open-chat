use ic_cdk::storage;
use shared::timestamp;
use crate::domain::user_store::{RegisterUserResult, UserStore};

pub fn update(username: String) -> RegisterUserResult {
    let principal = ic_cdk::caller();
    let now = timestamp::now();

    let user_store: &mut UserStore = storage::get_mut();

    user_store.register_user(principal, username, now)
}