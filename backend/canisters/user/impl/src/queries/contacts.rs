use crate::guards::caller_is_owner;
use crate::read_state;
use ic_cdk_macros::query;
use user_canister::contacts::{Response::*, *};

#[query(guard = "caller_is_owner")]
fn contacts(_args: Args) -> Response {
    read_state(|state| {
        Success(SuccessResult {
            contacts: state
                .data
                .contacts
                .iter()
                .map(|(user_id, contact)| Contact {
                    user_id: *user_id,
                    nickname: contact.nickname.clone(),
                })
                .collect(),
        })
    })
}
