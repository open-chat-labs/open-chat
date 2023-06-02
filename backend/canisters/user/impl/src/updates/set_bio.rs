use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::FieldTooLongResult;
use user_canister::set_bio::{Response::*, *};

const MAX_BIO_LEN: u32 = 2000;

#[update(guard = "caller_is_owner")]
#[trace]
fn set_bio(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_bio_impl(args, state))
}

fn set_bio_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    let length_provided = args.text.len() as u32;
    if length_provided > MAX_BIO_LEN {
        return TooLong(FieldTooLongResult {
            length_provided,
            max_length: MAX_BIO_LEN,
        });
    }

    state.data.bio = args.text;
    Success
}
