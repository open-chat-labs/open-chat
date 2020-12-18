use ic_cdk::storage;
use crate::domain::user_data::{SetUsernameResponse, UserData};

pub fn update(username: String) -> bool {
    let principal = ic_cdk::caller();
    
    let user_data: &mut UserData = storage::get_mut();

    let result = user_data.set_username(principal, username);

    match result {
        SetUsernameResponse::Success => true,
        SetUsernameResponse::SuccessNoChange => true,
        SetUsernameResponse::UsernameTaken => false
    }
}