use ic_cdk_macros::*;
use ic_types::Principal;
use crate::domain::user_store::{RegisterUserResult, UpdateUsernameResult, UserSummary};
use crate::queries::*;
use crate::updates::*;

#[update]
pub fn register_user(username: String) -> RegisterUserResult {
    register_user::update(username)
}

#[update]
pub fn update_username(username: String) -> UpdateUsernameResult {
    set_username::update(username)
}

#[query]
pub fn get_username() -> Option<String> {
    get_username::query()
}

#[query]
pub fn get_principal(username: String) -> Option<Principal> {
    get_principal::query(&username)
}

#[query]
pub fn get_users(users: Vec<get_users::GetUserRequest>) -> Vec<UserSummary> {
    get_users::query(users)
}