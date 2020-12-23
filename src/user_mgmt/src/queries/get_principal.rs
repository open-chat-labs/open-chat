use ic_cdk::storage;
use ic_types::Principal;
use crate::domain::user_store::UserStore;

pub fn query(username: &String) -> Option<Principal> {
    let user_store: &UserStore = storage::get();
    
    user_store.get_principal(username)
}