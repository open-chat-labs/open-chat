use ic_cdk::storage;
use shared::user_id::UserId;
use crate::domain::user_store::UserStore;

pub fn query(username: &String) -> Option<UserId> {
    let user_store: &UserStore = storage::get();
    
    user_store.get_user_id(username)
}