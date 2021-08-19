use crate::domain::user_store::{RegisterUserResponse, UserStore};
use ic_cdk::storage;
use shared::timestamp;

pub fn update(username: String) -> RegisterUserResponse {
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let user_store: &mut UserStore = storage::get_mut();

    user_store.register_user(me, username, now)
}
