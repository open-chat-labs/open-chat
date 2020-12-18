use ic_cdk_macros::*;
use ic_types::Principal;
use crate::handlers::*;

#[update]
pub fn set_username(username: String) -> bool {
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