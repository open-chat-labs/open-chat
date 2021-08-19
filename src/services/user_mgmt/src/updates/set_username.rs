use crate::domain::user_store::{UpdateUsernameResponse, UserStore};
use ic_cdk::storage;
use shared::timestamp;

pub fn update(username: String) -> UpdateUsernameResponse {
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let user_store: &mut UserStore = storage::get_mut();

    user_store.update_username(me, username, now)
}
