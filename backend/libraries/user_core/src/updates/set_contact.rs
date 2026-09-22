use crate::{SetContactResponse, User};
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::set_contact::Args;

pub fn set_contact(user: &mut User, args: Args) -> OCResult {
    user.verify_not_suspended()?;

    match user.contacts.set_contact(args.contact) {
        SetContactResponse::Success => Ok(()),
        SetContactResponse::NoChange => Err(OCErrorCode::NoChange.into()),
        SetContactResponse::NicknameTooLong(n) => Err(OCErrorCode::NameTooLong.with_json(&n)),
        SetContactResponse::NicknameTooShort(n) => Err(OCErrorCode::NameTooShort.with_json(&n)),
    }
}
