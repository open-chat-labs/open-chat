use ic_cdk::storage;
use shared::timestamp;
use crate::domain::user_store::{RegisterUserResult, UserStore};

pub fn update(username: String) -> RegisterUserResult {
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let user_store: &mut UserStore = storage::get_mut();

    user_store.register_user(me, username, now)
}