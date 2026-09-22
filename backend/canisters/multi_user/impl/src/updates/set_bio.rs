use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{Achievement, OCResult};
use user_canister::set_bio::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_bio(args: Args) -> Response {
    mutate_state(|state| set_bio_impl(args, state)).into()
}

fn set_bio_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let my_index =
        state.with_caller_user_mut(|my_index, user| user_core::updates::set_bio(user, args.text, now).map(|_| my_index))?;
    state.award_achievement_and_notify(my_index, Achievement::SetBio, now);
    Ok(())
}
