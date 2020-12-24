use ic_cdk::storage;
use shared::timestamp;
use crate::domain::user_store::{UpdateUsernameResult, UserStore};

pub fn update(username: String) -> UpdateUsernameResult {
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let user_store: &mut UserStore = storage::get_mut();

    user_store.update_username(me, username, now)
}