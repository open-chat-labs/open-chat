use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{FieldTooLongResult, OCResult, Timestamped};
use user_canister::set_bio::*;

// The same limit as the User canister
const MAX_BIO_LEN: u32 = 2000;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_bio(args: Args) -> Response {
    mutate_state(|state| set_bio_impl(args, state)).into()
}

fn set_bio_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let length_provided = args.text.chars().count() as u32;
    if length_provided > MAX_BIO_LEN {
        return Err(OCErrorCode::TextTooLong.with_json(&FieldTooLongResult {
            length_provided,
            max_length: MAX_BIO_LEN,
        }));
    }

    let now = state.env.now();
    state.with_caller_user_mut(|_, user| -> OCResult<()> {
        user.verify_not_suspended()?;
        user.bio = Timestamped::new(args.text, now);
        Ok(())
    })?;

    // TODO: Award the `SetBio` achievement once achievements are held per user

    Ok(())
}
