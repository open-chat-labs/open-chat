use ic_cdk::storage;
use ic_types::Principal;
use crate::domain::user_data::UserData;

pub fn query(username: &String) -> Option<Principal> {
    let user_data: &UserData = storage::get();
    
    user_data.get_principal(username)
}