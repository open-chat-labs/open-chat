use ic_cdk_macros::*;
use shared::user_id::UserId;
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
pub fn get_current_user() -> Option<UserSummary> {
    get_current_user::query()
}

#[query]
pub fn get_user_id(username: String) -> Option<UserId> {
    get_user_id::query(&username)
}

#[query]
pub fn get_users(users: Vec<get_users::Request>) -> Vec<UserSummary> {
    get_users::query(users)
}