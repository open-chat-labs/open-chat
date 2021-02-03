use ic_cdk_macros::*;
use crate::queries::*;
use crate::updates::*;
use shared::timestamp::Timestamp;

#[update]
pub fn add_offer(request: add_offer::Request) -> add_offer::Response {
    add_offer::update(request)
}

#[update]
pub fn add_answer(request: add_answer::Request) {
    add_answer::update(request);
}

#[update]
pub fn remove_connection_details(request: remove_connection_details::Request) -> u32 {
    remove_connection_details::update(request)
}

#[query]
pub fn get_connection_details(updated_since: Option<Timestamp>) -> get_connection_details::Response {
    get_connection_details::query(updated_since)
}
