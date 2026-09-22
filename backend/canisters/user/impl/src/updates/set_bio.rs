use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, OCResult};
use user_canister::set_bio::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_bio(args: Args) -> Response {
    execute_update(|state| set_bio_impl(args, state)).into()
}

fn set_bio_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    user_core::updates::set_bio(&mut state.data.user, args.text, now)?;
    state.award_achievement_and_notify(Achievement::SetBio, now);
    Ok(())
}
