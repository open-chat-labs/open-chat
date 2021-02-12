use ic_cdk_macros::*;
use crate::domain::user_store::{RegisterUserResponse, TransferCyclesResponse, UpdateUsernameResponse};
use crate::queries::*;
use crate::updates::*;

#[update]
pub fn register_user(username: String) -> RegisterUserResponse {
    register_user::update(username)
}

#[update]
pub fn update_username(username: String) -> UpdateUsernameResponse {
    set_username::update(username)
}

#[update]
pub fn mark_as_online() {
    mark_as_online::update();
}

#[update]
pub fn transfer_cycles(request: transfer_cycles::Request) -> TransferCyclesResponse {
    transfer_cycles::update(request)
}

#[query]
pub fn get_current_user() -> get_current_user::Response {
    get_current_user::query()
}

#[query]
pub fn get_user_id(username: String) -> get_user_id::Response {
    get_user_id::query(&username)
}

#[query]
pub fn get_users(request: get_users::Request) -> get_users::Response {
    get_users::query(request)
}

#[query]
pub fn search_users(request: search_users::Request) -> search_users::Response {
    search_users::query(request)
}