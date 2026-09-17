use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::set_contact::*;
use user_state::SetContactResponse;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_contact(args: Args) -> Response {
    mutate_state(|state| set_contact_impl(args, state)).into()
}

fn set_contact_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.with_caller_user_mut(|_, user| {
        user.verify_not_suspended()?;

        match user.contacts.set_contact(args.contact) {
            SetContactResponse::Success => Ok(()),
            SetContactResponse::NoChange => Err(OCErrorCode::NoChange.into()),
            SetContactResponse::NicknameTooLong(n) => Err(OCErrorCode::NameTooLong.with_json(&n)),
            SetContactResponse::NicknameTooShort(n) => Err(OCErrorCode::NameTooShort.with_json(&n)),
        }
    })
}
