use crate::domain::user_store::UserStore;
use ic_cdk::storage;
use shared::timestamp;

pub fn update() {
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let user_store: &mut UserStore = storage::get_mut();

    user_store.mark_as_online(&me, now);
}
