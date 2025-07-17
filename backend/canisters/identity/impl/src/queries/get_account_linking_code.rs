use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use identity_canister::get_account_linking_code::{Response::*, *};
use types::{AccountLinkingCode, UserId};

#[query(msgpack = true, candid = true)]
fn get_account_linking_code(_args: Args) -> Response {
    read_state(get_account_linking_code_impl)
}

// Fetches existing account linking code for the caller's user ID.
fn get_account_linking_code_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();

    if let Some(user_id) = state.get_user_id_by_caller() {
        if let Some(linking_code) = find_account_linking_code_for_user_id(state, user_id) {
            if linking_code.is_valid(now) { Success(linking_code.clone()) } else { NotFound }
        } else {
            NotFound
        }
    } else {
        NotFound
    }
}

fn find_account_linking_code_for_user_id(state: &RuntimeState, user_id: UserId) -> Option<AccountLinkingCode> {
    state
        .data
        .account_linking_codes
        .iter()
        .find(|(_, linking_code)| linking_code.user_id == user_id)
        .map(|(_, linking_code)| linking_code.clone())
}
