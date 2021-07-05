use crate::canister::RUNTIME_STATE;
use crate::queries::current_user;
use crate::queries::pending_sms_messages;
use crate::queries::user;
use crate::queries::users;
use crate::updates::confirm_phone_number;
use crate::updates::mark_as_online;
use crate::updates::resend_code;
use crate::updates::set_username;
use crate::updates::submit_phone_number;
use ic_cdk_macros::query;
use ic_cdk_macros::update;

#[update]
fn submit_phone_number(request: submit_phone_number::Request) -> submit_phone_number::Response {
    RUNTIME_STATE.with(|state| submit_phone_number::update(request, state.borrow_mut().as_mut().unwrap()))
}

#[update]
fn confirm_phone_number(request: confirm_phone_number::Request) -> confirm_phone_number::Response {
    RUNTIME_STATE.with(|state| confirm_phone_number::update(request, state.borrow_mut().as_mut().unwrap()))
}

#[update]
pub async fn resend_code(_: resend_code::Request) -> resend_code::Response {
    RUNTIME_STATE.with(|state| resend_code::update(state.borrow_mut().as_mut().unwrap()))
}

#[update]
fn set_username(request: set_username::Request) -> set_username::Response {
    RUNTIME_STATE.with(|state| set_username::update(request, state.borrow_mut().as_mut().unwrap()))
}

#[update]
fn mark_as_online(_: mark_as_online::Request) {
    RUNTIME_STATE.with(|state| mark_as_online::update(state.borrow_mut().as_mut().unwrap()))
}

#[query]
fn current_user(_request: current_user::Request) -> current_user::Response {
    RUNTIME_STATE.with(|state| current_user::query(state.borrow().as_ref().unwrap()))
}

#[query]
pub fn pending_sms_messages(request: pending_sms_messages::Request) -> pending_sms_messages::Response {
    RUNTIME_STATE.with(|state| pending_sms_messages::query(request, state.borrow().as_ref().unwrap()))
}

#[query]
pub fn user(request: user::Request) -> user::Response {
    RUNTIME_STATE.with(|state| user::query(request, state.borrow().as_ref().unwrap()))
}

#[query]
pub fn users(request: users::Request) -> users::Response {
    RUNTIME_STATE.with(|state| users::query(request, state.borrow().as_ref().unwrap()))
}

#[query]
pub fn user(request: user::Request) -> user::Response {
    RUNTIME_STATE.with(|state| {
        user::query(request, state.borrow().as_ref().unwrap())
    })
}

#[query]
pub fn users(request: users::Request) -> users::Response {
    RUNTIME_STATE.with(|state| {
        users::query(request, state.borrow().as_ref().unwrap())
    })
}
