use ic_cdk::storage;
use crate::domain::user_data::UserData;

pub fn query() -> Option<String> {
    let principal = ic_cdk::caller();

    let user_data: &UserData = storage::get();
    
    user_data.get_username(&principal)
}