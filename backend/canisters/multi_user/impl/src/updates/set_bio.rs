use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::set_bio::*;
use types::{Achievement, OCResult};
use user_core::mentions::replace_mentioned_users;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_bio(args: Args) -> Response {
    execute_update(|state| set_bio_impl(args, state)).into()
}

fn set_bio_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    // A client which hasn't yet heard that a user mentioned has been migrated to a MultiUser
    // canister mentions them by their old id
    let migrated_user_ids = &state.data.migrated_user_ids;
    let text = replace_mentioned_users(&args.text, |user_id| migrated_user_ids.latest(user_id)).unwrap_or(args.text);
    let my_index =
        state.with_caller_user_mut(|my_index, user| user_core::updates::set_bio(user, text, now).map(|_| my_index))?;
    state.award_achievement_and_notify(my_index, Achievement::SetBio, now);
    Ok(())
}
