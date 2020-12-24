use ic_cdk::storage;
use crate::domain::user_store::UserStore;

pub fn query() -> Option<String> {
    let me = shared::user_id::get_current();

    let user_store: &UserStore = storage::get();
    
    user_store.get_username(&me)
}