use crate::canister::RUNTIME_STATE;
use crate::queries::current_user;
use crate::queries::metrics;
use crate::queries::pending_sms_messages;
use crate::queries::search;
use crate::queries::user;
use crate::queries::users;
use crate::updates::confirm_phone_number;
use crate::updates::create_canister;
use crate::updates::mark_as_online;
use crate::updates::resend_code;
use crate::updates::set_username;
use crate::updates::submit_phone_number;
use ic_cdk_macros::query;
use ic_cdk_macros::update;

#[update]
fn submit_phone_number(args: submit_phone_number::Args) -> submit_phone_number::Response {
    RUNTIME_STATE.with(|state| submit_phone_number::update(args, state.borrow_mut().as_mut().unwrap()))
}

#[update]
fn confirm_phone_number(args: confirm_phone_number::Args) -> confirm_phone_number::Response {
    RUNTIME_STATE.with(|state| confirm_phone_number::update(args, state.borrow_mut().as_mut().unwrap()))
}

#[update]
pub async fn resend_code(_: resend_code::Args) -> resend_code::Response {
    RUNTIME_STATE.with(|state| resend_code::update(state.borrow_mut().as_mut().unwrap()))
}

#[update]
fn set_username(args: set_username::Args) -> set_username::Response {
    RUNTIME_STATE.with(|state| set_username::update(args, state.borrow_mut().as_mut().unwrap()))
}

#[update]
fn mark_as_online(_args: mark_as_online::Args) {
    RUNTIME_STATE.with(|state| mark_as_online::update(state.borrow_mut().as_mut().unwrap()))
}

#[update]
async fn create_canister(_args: create_canister::Args) -> create_canister::Response {
    create_canister::update().await
}

#[query]
fn current_user(_args: current_user::Args) -> current_user::Response {
    RUNTIME_STATE.with(|state| current_user::query(state.borrow().as_ref().unwrap()))
}

#[query]
pub fn pending_sms_messages(args: pending_sms_messages::Args) -> pending_sms_messages::Response {
    RUNTIME_STATE.with(|state| pending_sms_messages::query(args, state.borrow().as_ref().unwrap()))
}

#[query]
pub fn user(args: user::Args) -> user::Response {
    RUNTIME_STATE.with(|state| user::query(args, state.borrow().as_ref().unwrap()))
}

#[query]
pub fn users(args: users::Args) -> users::Response {
    RUNTIME_STATE.with(|state| users::query(args, state.borrow().as_ref().unwrap()))
}

#[query]
pub fn search(args: search::Args) -> search::Response {
    RUNTIME_STATE.with(|state| search::query(args, state.borrow().as_ref().unwrap()))
}

#[query]
pub fn metrics(_args: metrics::Args) -> metrics::Response {
    RUNTIME_STATE.with(|state| metrics::query(state.borrow().as_ref().unwrap()))
}
