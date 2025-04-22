use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{Achievement, FieldTooLongResult, OCResult, Timestamped};
use user_canister::set_bio::*;

const MAX_BIO_LEN: u32 = 2000;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_bio(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_bio_impl(args, state)).into()
}

fn set_bio_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    let length_provided = args.text.chars().count() as u32;
    if length_provided > MAX_BIO_LEN {
        return Err(OCErrorCode::TextTooLong.with_json(&FieldTooLongResult {
            length_provided,
            max_length: MAX_BIO_LEN,
        }));
    }

    let now = state.env.now();
    state.data.bio = Timestamped::new(args.text, now);
    state.award_achievement_and_notify(Achievement::SetBio, now);

    Ok(())
}
