use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::OCResult;
use user_canister::set_profile_background::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_profile_background(args: Args) -> Response {
    mutate_state(|state| set_profile_background_impl(args, state)).into()
}

fn set_profile_background_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let (my_index, id) = state.with_caller_user_mut(|my_index, user| {
        user_core::updates::set_profile_background(user, args.profile_background, now).map(|id| (my_index, id))
    })?;
    state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserSetProfileBackground(id), now);
    Ok(())
}
