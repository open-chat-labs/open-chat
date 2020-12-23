use ic_cdk::storage;
use crate::domain::user_store::UserStore;

pub fn query() -> Option<String> {
    let principal = ic_cdk::caller();

    let user_store: &UserStore = storage::get();
    
    user_store.get_username(&principal)
}